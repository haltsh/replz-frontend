<script setup lang="ts">
import { ref } from 'vue'
import { 
  uploadReceiptImage, 
  getOcrItems, 
  upsertItemsBatch,
  addToInventory 
} from '@/api'
import { API_HOST } from '@/config/api'

type ItemRow = {
  item_name: string
  category: string
  quantity: number
  unit: string
  expiration_date: string | null
  basic_expiration_days: number | null
}

const file = ref<File | null>(null)
const receiptId = ref<number | null>(null)
const imageUrl = ref<string | null>(null)
const items = ref<ItemRow[]>([])
const uploading = ref(false)
const saving = ref(false)
const notice = ref('영수증을 업로드하면 자동으로 식재료를 인식합니다.')

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  file.value = target.files?.[0] || null
}

const categoryExpirationDays: Record<string, number> = {
  '채소': 3,
  '과일': 5,
  '육류': 3,
  '생선': 2,
  '유제품': 14,
  '가공식품': 30,
  '곡류': 30,
  '기타': 7
}

const categoryDefaultUnit: Record<string, string> = {
  '채소': '개',
  '과일': '개',
  '육류': 'g',
  '생선': 'g',
  '유제품': 'ml',
  '가공식품': '개',
  '곡류': 'kg',
  '기타': '개'
}

function calculateExpirationDate(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

async function uploadAndExtract() {
  if (!file.value) {
    alert('파일을 선택해주세요.')
    return
  }

  uploading.value = true
  notice.value = '이미지 업로드 중...'

  try {
    // ✅ userId 파라미터 제거 (API 함수에서 자동으로 가져옴)
    const res = await uploadReceiptImage(file.value)
    receiptId.value = res.receipt_id
    imageUrl.value = res.image_url

    notice.value = 'OCR 처리 완료! 결과를 확인하세요.'

    const extractedItems = res.extracted_items || []
    
    items.value = []
    
    if (typeof extractedItems === 'object' && !Array.isArray(extractedItems)) {
      for (const [itemName, itemData] of Object.entries(extractedItems)) {
        if (Array.isArray(itemData)) {
          const [category, quantity, basicDays, expirationDate] = itemData
          
          items.value.push({
            item_name: String(itemName).trim(),
            category: category || '기타',
            quantity: Number(quantity) || 1,
            unit: categoryDefaultUnit[category] || '개',
            basic_expiration_days: Number(basicDays) || categoryExpirationDays[category] || 7,
            expiration_date: expirationDate || null
          })
        } else {
          items.value.push({
            item_name: String(itemName).trim(),
            category: '기타',
            quantity: 1,
            unit: '개',
            basic_expiration_days: 7,
            expiration_date: null
          })
        }
      }
    } else if (Array.isArray(extractedItems)) {
      items.value = extractedItems.map((x: any) => ({
        item_name: String(x.item_name || x || '').trim(),
        category: x.category || '기타',
        quantity: Number(x.quantity) || 1,
        unit: x.unit || categoryDefaultUnit[x.category] || '개',
        basic_expiration_days: Number(x.basic_expiration_days) || 7,
        expiration_date: x.expiration_date || null
      }))
    }

    items.value = items.value.map(item => {
      if (!item.expiration_date && item.basic_expiration_days) {
        item.expiration_date = calculateExpirationDate(item.basic_expiration_days)
      }
      return item
    })

    notice.value = `✅ ${items.value.length}개 식재료 인식 완료! 정보를 수정하고 저장하세요.`
  } catch (error: any) {
    console.error('OCR 처리 오류:', error)
    notice.value = `❌ ${error.message || '처리 실패'}`
  } finally {
    uploading.value = false
  }
}

async function saveItemsToMaster() {
  if (!items.value.length) {
    alert('저장할 항목이 없습니다.')
    return
  }

  saving.value = true
  try {
    const payload = items.value.map(({ item_name, category, basic_expiration_days }) => ({
      item_name,
      category,
      basic_expiration_days: basic_expiration_days ?? null,
    }))

    await upsertItemsBatch({ items: payload })
    notice.value = '✅ items 테이블에 저장 완료!'
  } catch (error: any) {
    notice.value = `❌ ${error.message || 'DB 저장 실패'}`
  } finally {
    saving.value = false
  }
}

async function saveToInventory() {
  if (!items.value.length) {
    alert('저장할 항목이 없습니다.')
    return
  }

  saving.value = true
  try {
    // ✅ user_id 제거 (API 함수에서 자동으로 가져옴)
    const payload = {
      items: items.value.map(({ item_name, quantity,unit, expiration_date, basic_expiration_days }) => {
        let finalDate = expiration_date
        if (!finalDate && basic_expiration_days) {
          finalDate = calculateExpirationDate(basic_expiration_days)
        }

        return {
          item_name,
          quantity,
          unit,
          expiration_date: finalDate,
        }
      }),
    }

    await addToInventory(payload)
    notice.value = '✅ 냉장고에 재고 추가 완료!'
    items.value = []
  } catch (error: any) {
    notice.value = `❌ ${error.message || '재고 추가 실패'}`
  } finally {
    saving.value = false
  }
}

function removeItem(index: number) {
  items.value.splice(index, 1)
}

function onCategoryChange(item: ItemRow) {
  const defaultDays = categoryExpirationDays[item.category] || 7
  item.basic_expiration_days = defaultDays
  item.expiration_date = calculateExpirationDate(defaultDays)
  item.unit = categoryDefaultUnit[item.category] || '개'
}

function onDaysChange(item: ItemRow) {
  if (item.basic_expiration_days && item.basic_expiration_days > 0) {
    item.expiration_date = calculateExpirationDate(item.basic_expiration_days)
  }
}
</script>

<template>
  <div class="scan-container">
    <!-- 상단 알림 -->
    <div class="notice-banner" :class="{ error: notice.includes('❌') }">
      {{ notice }}
    </div>

    <!-- 업로드 카드 -->
    <div class="scan-card">
      <h2 class="card-title">📸 영수증 스캔</h2>
      <div class="upload-section">
        <input 
          type="file" 
          accept="image/*,application/pdf" 
          @change="onFileChange"
          :disabled="uploading"
          class="file-input"
        />
        <button 
          class="btn-upload" 
          :disabled="!file || uploading" 
          @click="uploadAndExtract"
        >
          {{ uploading ? '처리 중...' : '업로드 & 인식' }}
        </button>
      </div>

      <div v-if="imageUrl" class="preview">
        <img :src="`${API_HOST}${imageUrl}`" alt="영수증" />
      </div>
    </div>

    <!-- 인식 결과 카드 -->
    <div v-if="items.length" class="scan-card">
      <h2 class="card-title">🛒 인식된 식재료 ({{ items.length }}개)</h2>
      <p class="hint">정보를 확인하고 수정한 후 저장하세요.</p>

      <div class="table-wrapper">
        <table class="item-table">
          <thead>
            <tr>
              <th class="col-name">식재료명</th>
              <th class="col-category">카테고리</th>
              <th class="col-unit">단위</th>
              <th class="col-quantity">수량</th>
              <th class="col-days">유통기한(일)</th>
              <th class="col-date">실제 유통기한</th>
              <th class="col-delete">삭제</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in items" :key="i">
              <td class="col-name">
                <input type="text" v-model.trim="item.item_name" />
              </td>
              <td class="col-category">
                <select v-model="item.category" @change="onCategoryChange(item)">
                  <option>채소</option>
                  <option>과일</option>
                  <option>육류</option>
                  <option>생선</option>
                  <option>유제품</option>
                  <option>가공식품</option>
                  <option>곡류</option>
                  <option>기타</option>
                </select>
              </td>
              <td class="col-unit">
                <select v-model="item.unit">
                  <option value="개">개</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="묶음">묶음</option>
                  <option value="팩">팩</option>
                </select>
              </td>
              <td class="col-quantity">
                <input type="number" min="1" v-model.number="item.quantity" />
              </td>
              <td class="col-days">
                <input 
                  type="number" 
                  min="0" 
                  v-model.number="item.basic_expiration_days"
                  @input="onDaysChange(item)"
                />
              </td>
              <td class="col-date">
                <input type="date" v-model="item.expiration_date" />
              </td>
              <td class="col-delete">
                <button class="btn-delete" @click="removeItem(i)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="button-group">
        <button class="btn-secondary" :disabled="saving" @click="saveItemsToMaster">
          items 테이블에 저장
        </button>
        <button class="btn-primary" :disabled="saving" @click="saveToInventory">
          냉장고에 추가
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scan-container {
  height: 100%;
  overflow-y: auto;
  background: #f8f9fa;
  padding: 16px;
}

.notice-banner {
  background: #e3f2fd;
  padding: 14px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-weight: 500;
  text-align: center;
  font-size: 14px;
  color: #1976d2;
  border: 1px solid #bbdefb;
}

.notice-banner.error {
  background: #fee;
  color: #c33;
  border-color: #fcc;
}

.scan-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-title {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.upload-section {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.file-input {
  flex: 1;
  min-width: 200px;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.file-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-upload {
  padding: 10px 20px;
  background: #FF6600;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-upload:hover:not(:disabled) {
  background: #e55a00;
  transform: translateY(-1px);
}

.btn-upload:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview {
  margin-top: 16px;
}

.preview img {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  border: 2px solid #e0e0e0;
}

.hint {
  color: #666;
  font-size: 13px;
  margin-bottom: 12px;
}

.table-wrapper {
  overflow-x: auto;
  margin-bottom: 16px;
}

.item-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  min-width: 700px;
}

.item-table th,
.item-table td {
  padding: 10px 8px;
  border: 1px solid #e0e0e0;
  text-align: left;
}

.item-table th {
  background: #f5f5f5;
  font-weight: 600;
  font-size: 13px;
  color: #555;
}

.col-name { width: 25%; min-width: 150px; }
.col-category { width: 15%; min-width: 100px; }
.col-unit { width: 12%; min-width: 90px; }
.col-quantity { width: 10%; min-width: 70px; }
.col-days { width: 15%; min-width: 100px; }
.col-date { width: 25%; min-width: 130px; }
.col-delete { width: 10%; min-width: 70px; text-align: center; }


.item-table input,
.item-table select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

.item-table select {
  cursor: pointer;
  background: white;
}

.item-table input[type="number"] {
  text-align: center;
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.btn-primary,
.btn-secondary,
.btn-delete {
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #FF6600;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #e55a00;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #757575;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #616161;
  transform: translateY(-1px);
}

.btn-delete {
  background: #ef5350;
  color: white;
  padding: 6px 12px;
}

.btn-delete:hover {
  background: #e53935;
  transform: scale(1.05);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 스크롤바 스타일 */
.scan-container::-webkit-scrollbar {
  width: 8px;
}

.scan-container::-webkit-scrollbar-track {
  background: #e5e5e5;
  border-radius: 4px;
}

.scan-container::-webkit-scrollbar-thumb {
  background: #FF6600;
  border-radius: 4px;
}

@media (max-width: 800px) {
  .item-table {
    font-size: 12px;
  }
  
  .button-group {
    flex-direction: column;
  }
  
  .btn-primary,
  .btn-secondary {
    width: 100%;
  }
}
</style>