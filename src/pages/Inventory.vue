<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { listInventory, deleteInventory } from '@/api'
import { API_BASE } from '@/config/api'

type Row = {
  inventory_id: number; item_id: number; item_name: string;
  quantity: number; expiration_date?: string|null; purchased_date?: string|null;
  dday?: number|null; created_at?: string; updated_at?: string;
}

type Item = {
  item_id: number;
  item_name: string;
  category?: string;
}

const rows = ref<Row[]>([])
const items = ref<Item[]>([])
const q = ref('')

const newInventory = ref({
  item_id: 0,
  quantity: 1,
  expiration_date: ''
})

const isAdding = ref(false)

const notification = ref({
  show: false,
  message: '',
  type: 'success' as 'success' | 'error'
})

function showNotification(message: string, type: 'success' | 'error' = 'success') {
  notification.value = { show: true, message, type }
  setTimeout(() => {
    notification.value.show = false
  }, 3000)
}

async function loadItems() {
  try {
    const response = await fetch(`${API_BASE}/items`)
    const data = await response.json()
    items.value = data
    if (data.length > 0) {
      newInventory.value.item_id = data[0].item_id
    }
  } catch (error) {
    console.error('품목 목록 로드 실패:', error)
  }
}

async function load() {
  const data = await listInventory()
  rows.value = data
}

onMounted(() => {
  load()
  loadItems()
})

async function removeItem(id: number) {
  if (!confirm('정말 삭제하시겠습니까?')) return
  
  try {
    await deleteInventory(id)
    rows.value = rows.value.filter(r => r.inventory_id !== id)
    showNotification('삭제되었습니다!', 'success')
  } catch (error) {
    console.error('삭제 실패:', error)
    showNotification('삭제에 실패했습니다.', 'error')
  }
}

async function addInventory() {
  if (!newInventory.value.item_id) {
    showNotification('품목을 선택해주세요.', 'error')
    return
  }
  
  if (!newInventory.value.expiration_date) {
    showNotification('유통기한을 입력해주세요.', 'error')
    return
  }
  
  isAdding.value = true
  
  try {
    const response = await fetch(`${API_BASE}/inventories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 1,
        item_id: newInventory.value.item_id,
        quantity: newInventory.value.quantity,
        expiration_date: newInventory.value.expiration_date
      })
    })
    
    if (!response.ok) throw new Error('추가 실패')
    
    await load()
    
    newInventory.value = {
      item_id: items.value[0]?.item_id || 0,
      quantity: 1,
      expiration_date: ''
    }
    
    showNotification('재고가 추가되었습니다!', 'success')
  } catch (error) {
    console.error('추가 실패:', error)
    showNotification('추가에 실패했습니다.', 'error')
  } finally {
    isAdding.value = false
  }
}

const filtered = computed(() => {
  const w = q.value.trim().toLowerCase()
  return rows.value
    .filter(r => !w || r.item_name.toLowerCase().includes(w))
    .sort((a,b) => {
      const ad = a.dday ?? 9e9, bd = b.dday ?? 9e9
      return ad - bd || a.item_name.localeCompare(b.item_name)
    })
})

function formatDday(dday: number | null | undefined) {
  if (dday == null) return '-'
  if (dday < 0) return `D+${Math.abs(dday)}`
  if (dday === 0) return 'D-Day'
  return `D-${dday}`
}

function getDdayStyle(dday: number | null | undefined) {
  if (dday == null) return {}
  if (dday <= 0) return { color: '#dc2626', fontWeight: 'bold' }
  if (dday <= 3) return { color: '#ea580c', fontWeight: 'bold' }
  if (dday <= 7) return { color: '#ca8a04' }
  return {}
}
</script>

<template>
  <div class="app-root">
    <div class="page-content">
      <div class="page-content">
        <!-- 토스트 알림 -->
        <div 
          v-if="notification.show" 
          class="toast-notification"
          :class="notification.type"
        >
          {{ notification.message }}
        </div>

        <!-- 재고 관리 섹션 (고정) -->
        <div class="add-section-wrapper">
          <section class="add-section">
            <h3 class="section-title">📦 재고 관리</h3>
            <div class="add-form">
              <div class="form-row">
                <div class="form-group">
                  <label>품목</label>
                  <select 
                    v-model.number="newInventory.item_id" 
                    class="form-input"
                  >
                    <option value="0" disabled>품목 선택</option>
                    <option 
                      v-for="item in items" 
                      :key="item.item_id" 
                      :value="item.item_id"
                    >
                      {{ item.item_name }}
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label>수량</label>
                  <input 
                    type="number" 
                    v-model.number="newInventory.quantity" 
                    class="form-input"
                    min="1"
                  />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group full">
                  <label>유통기한</label>
                  <input 
                    type="date" 
                    v-model="newInventory.expiration_date" 
                    class="form-input"
                  />
                </div>
              </div>
              <button 
                class="add-btn" 
                @click="addInventory" 
                :disabled="isAdding"
              >
                {{ isAdding ? '추가 중...' : '➕ 추가하기' }}
              </button>
            </div>
          </section>
        </div>

        <!-- 재고 확인 섹션 (스크롤) -->
        <div class="inventory-section-wrapper">
          <section class="inventory-section">
            <div class="section-header">
              <h3 class="section-title">📋 재고 확인</h3>
              <span class="count-badge">{{ filtered.length }}개</span>
            </div>
            
            <div class="search-bar">
              <input 
                class="search-input" 
                placeholder="🔍 검색..." 
                v-model="q"
              >
            </div>

            <div class="inventory-list">
              <div 
                v-for="r in filtered" 
                :key="r.inventory_id"
                class="inventory-item"
              >
                <div class="item-info">
                  <div class="item-name">{{ r.item_name }}</div>
                  <div class="item-details">
                    <span class="quantity">수량: {{ r.quantity }}</span>
                    <span class="expiry">{{ r.expiration_date || '-' }}</span>
                  </div>
                </div>
                <div class="item-actions">
                  <div class="dday" :style="getDdayStyle(r.dday)">
                    {{ formatDday(r.dday) }}
                  </div>
                  <button 
                    class="delete-btn" 
                    @click="removeItem(r.inventory_id)"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}
html, body {
  margin: 0;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.app-root {
  width: 100%;
  height: 100%;
  background: #f8f9fa;
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
}
/* 상단 고정 영역 */
.add-section-wrapper {
  flex-shrink: 0;
}

.page-content {
  display: flex;
  flex-direction: column;
  height: 100%;   
  overflow: hidden;
}

.inventory-section-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 0;       /* 스크롤 영역 계산에 파괴적으로 중요 */
  -webkit-overflow-scrolling: touch;
}

.app-container {
  width: 100%;
  height: 100vh;
  max-width: 428px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  position: relative;
}

/* 상단바 */
.top-bar {
  height: 10vh;
  background: #FF6600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logo {
  height: 60%;
}

.logo-img {
  height: 100%;
  width: auto;
}

.scan-btn {
  background: white;
  color: #FF6600;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.scan-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 메인 콘텐츠 */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 0;
}

/* 토스트 알림 */
.toast-notification {
  position: fixed;
  top: 12vh;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.toast-notification.success {
  background: #10b981;
}

.toast-notification.error {
  background: #ef4444;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 재고 관리 섹션 (상단) */
.add-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  min-height: 180px;
  max-height: 22vh;
  display: flex;
  flex-direction: column;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.add-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row {
  display: flex;
  gap: 8px;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group.full {
  flex: 1;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.form-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #FF6600;
}

.add-btn {
  background: #FF6600;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: auto;
}

.add-btn:hover:not(:disabled) {
  background: #e55a00;
  transform: translateY(-1px);
}

.add-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 재고 확인 섹션 (하단) */
.inventory-section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.inventory-section-wrapper::-webkit-scrollbar {
  width: 8px;
}
.inventory-section-wrapper::-webkit-scrollbar-track {
  background: #e5e5e5;
  border-radius: 4px;
}
.inventory-section-wrapper::-webkit-scrollbar-thumb {
  background: #FF6600;
  border-radius: 4px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.count-badge {
  background: #FF6600;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.search-bar {
  margin-bottom: 12px;
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #FF6600;
}

.inventory-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inventory-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s;
}

.inventory-item:hover {
  border-color: #FF6600;
  transform: translateX(4px);
}

.item-info {
  flex: 1;
}

.item-name {
  font-weight: 600;
  font-size: 15px;
  color: #333;
  margin-bottom: 4px;
}

.item-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.quantity {
  font-weight: 500;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dday {
  font-weight: 700;
  font-size: 14px;
  min-width: 50px;
  text-align: right;
}

.delete-btn {
  background: #ef4444;
  color: white;
  border: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.delete-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

/* 하단바 */
.bottom-bar {
  height: 10vh;
  background: white;
  border-top: 2px solid #FF6600;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 20px;
}
.nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 16px;
  transition: all 0.2s;
  border-radius: 8px;
}

.nav-btn:hover {
  background: #fff5f0;
}

.nav-btn.active {
  background: #fff5f0;
}

.nav-btn.active .nav-icon {
  transform: scale(1.2);
}

.nav-btn.active .nav-label {
  color: #FF6600;
  font-weight: 700;
}

.nav-icon {
  font-size: 24px;
  transition: transform 0.2s;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
}

/* 스크롤바 스타일 - 항상 표시 */
.inventory-list::-webkit-scrollbar {
  width: 8px;
}

.inventory-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
  margin: 4px 0;
}

.inventory-list::-webkit-scrollbar-thumb {
  background: #FF6600;
  border-radius: 4px;
  min-height: 40px;
}

.inventory-list::-webkit-scrollbar-thumb:hover {
  background: #e55a00;
}

/* Firefox용 스크롤바 */
.inventory-list {
  scrollbar-width: thin;
  scrollbar-color: #FF6600 #f1f1f1;
}

/* 반응형 */
@media (max-width: 428px) {
  .app-container {
    max-width: 100%;
  }
}
</style>