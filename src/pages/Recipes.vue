<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { listInventory } from '@/api'

type InventoryItem = {
  inventory_id: number
  item_id: number
  item_name: string
  quantity: number
  expiration_date?: string | null
  dday?: number | null
}

type Recipe = {
  title: string
  url: string
  reviews: number
  image: string | null
  ingredients: string[]
  have: string[]
  need: string[]
}

type RecipeDetail = {
  title: string
  image: string | null
  ingredients: string[]
  steps: string[]
  tips?: string
  url: string
}

type HealthInfo = {
  총칼로리: number
  탄수화물: number
  당류: number
  지방: number
  단백질: number
  나트륨: number
}

// 재고 목록
const inventory = ref<InventoryItem[]>([])
const selectedIngredients = ref<Set<string>>(new Set())

// 레시피 관련
const recipes = ref<Recipe[]>([])
const loading = ref(false)
const searched = ref(false)
const error = ref('')

// 검색 필터
const searchQuery = ref('')

// Express 서버 URL
const EXPRESS_URL = 'http://localhost:3000/api'

// 모달 관련
const showModal = ref(false)
const modalLoading = ref(false)
const selectedRecipe = ref<RecipeDetail | null>(null)
const healthInfo = ref<HealthInfo | null>(null)
const healthLoading = ref(false)

// 재고 불러오기
onMounted(async () => {
  try {
    inventory.value = await listInventory()
  } catch (e) {
    console.error('재고 로드 실패:', e)
    error.value = '재고를 불러오는데 실패했습니다.'
  }
})

// 재료 선택/해제
function toggleIngredient(itemName: string) {
  if (selectedIngredients.value.has(itemName)) {
    selectedIngredients.value.delete(itemName)
  } else {
    selectedIngredients.value.add(itemName)
  }
}

// 전체 선택/해제
function toggleAll() {
  if (selectedIngredients.value.size === inventory.value.length) {
    selectedIngredients.value.clear()
  } else {
    inventory.value.forEach(item => {
      selectedIngredients.value.add(item.item_name)
    })
  }
}

// 레시피 검색
async function searchRecipes() {
  if (selectedIngredients.value.size === 0) {
    error.value = '최소 1개 이상의 재료를 선택해주세요.'
    return
  }

  loading.value = true
  error.value = ''
  searched.value = false
  recipes.value = []

  try {
    const response = await fetch(`${EXPRESS_URL}/recipes/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: Array.from(selectedIngredients.value),
        limit: 5,
        userId: 1
      })
    })

    if (!response.ok) {
      throw new Error(`서버 오류: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    recipes.value = data.recipes || []
    searched.value = true
  } catch (e: any) {
    console.error('레시피 검색 실패:', e)
    error.value = e.message || '레시피 검색에 실패했습니다.'
  } finally {
    loading.value = false
  }
}

// 건강 정보 가져오기
async function fetchHealthInfo(recipeUrl: string) {
  healthLoading.value = true
  healthInfo.value = null

  try {
    const response = await fetch(`${EXPRESS_URL}/recipes/health-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_url: recipeUrl })
    })

    if (!response.ok) {
      throw new Error('건강 정보를 가져오는데 실패했습니다.')
    }

    const data = await response.json()

    if (data.success && data.health_info) {
      healthInfo.value = data.health_info
    }
  } catch (e) {
    console.error('건강 정보 로드 실패:', e)
    // 실패해도 모달은 계속 표시
  } finally {
    healthLoading.value = false
  }
}

// 레시피 상세보기
async function openRecipeDetail(recipe: Recipe) {
  showModal.value = true
  modalLoading.value = true
  selectedRecipe.value = null
  healthInfo.value = null

  try {
    const response = await fetch(`${EXPRESS_URL}/recipes/fetch-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: recipe.url })
    })

    if (!response.ok) {
      throw new Error('레시피 상세 정보를 가져오는데 실패했습니다.')
    }

    const data = await response.json()
    selectedRecipe.value = {
      title: data.title || recipe.title,
      image: data.image || recipe.image,
      ingredients: data.ingredients || recipe.ingredients || [],
      steps: data.steps || [],
      tips: data.tips || '',
      url: recipe.url
    }

    // 건강 정보 가져오기 (병렬)
    fetchHealthInfo(recipe.url)
  } catch (e) {
    console.error('레시피 상세 정보 로드 실패:', e)
    selectedRecipe.value = {
      title: recipe.title,
      image: recipe.image,
      ingredients: recipe.ingredients,
      steps: ['레시피 상세 정보를 불러올 수 없습니다.'],
      url: recipe.url
    }
  } finally {
    modalLoading.value = false
  }
}

// 모달 닫기
function closeModal() {
  showModal.value = false
  selectedRecipe.value = null
  healthInfo.value = null
}

// 필터링된 레시피
const filteredRecipes = computed(() => {
  if (!searchQuery.value.trim()) return recipes.value

  const query = searchQuery.value.toLowerCase()
  return recipes.value.filter(r =>
    r.title.toLowerCase().includes(query) ||
    r.have.some(h => h.toLowerCase().includes(query)) ||
    r.need.some(n => n.toLowerCase().includes(query))
  )
})

// D-day 스타일용 클래스
function getDdayClass(dday: number | null | undefined) {
  if (dday == null) return ''
  if (dday <= 0) return 'expired'
  if (dday <= 3) return 'urgent'
  if (dday <= 7) return 'warning'
  return ''
}
</script>

<template>
  <!-- App.vue 안의 main-wrapper 안에 들어가는 단일 페이지 레이아웃 -->
  <div class="recipes-page">
    <div class="recipes-scroll">
      <!-- 상단: 재료 선택 카드 -->
      <section class="card ingredients-card">
        <h2 class="page-title">🍳 추천 레시피</h2>

        <p class="page-subtitle">
          냉장고 재료를 선택하면, 지금 만들 수 있는 레시피를 찾아드릴게요.
        </p>

        <div v-if="error" class="error-banner">
          {{ error }}
        </div>

        <div class="ingredients-section">
          <div class="section-header">
            <h3 class="section-title">
              📦 내 냉장고 재료
              <span class="count-badge">{{ inventory.length }}개</span>
            </h3>

            <button
              class="btn-secondary small"
              @click="toggleAll"
              v-if="inventory.length > 0"
            >
              {{ selectedIngredients.size === inventory.length ? '전체 해제' : '전체 선택' }}
            </button>
          </div>

          <div v-if="inventory.length === 0" class="empty-state">
            냉장고에 재고가 없습니다. 먼저 재고를 추가해주세요!
          </div>

          <div v-else class="ingredients-grid">
            <div
              v-for="item in inventory"
              :key="item.inventory_id"
              class="ingredient-card"
              :class="[
                selectedIngredients.has(item.item_name) ? 'selected' : '',
                getDdayClass(item.dday)
              ]"
              @click="toggleIngredient(item.item_name)"
            >
              <div class="ingredient-name">
                {{ item.item_name }}
              </div>

              <div class="ingredient-info">
                <span class="quantity">{{ item.quantity }}개</span>
                <span v-if="item.dday != null" class="dday">
                  {{ item.dday <= 0 ? '기한만료' : `D-${item.dday}` }}
                </span>
              </div>

              <div
                v-if="selectedIngredients.has(item.item_name)"
                class="check-icon"
              >
                ✓
              </div>
            </div>
          </div>

          <div
            class="selected-count"
            v-if="selectedIngredients.size > 0"
          >
            선택된 재료:
            <strong>{{ selectedIngredients.size }}개</strong>
          </div>

          <button
            class="btn-primary full"
            :disabled="loading || selectedIngredients.size === 0"
            @click="searchRecipes"
          >
            {{ loading ? '레시피 검색 중...' : '레시피 찾기 🔍' }}
          </button>
        </div>
      </section>

      <!-- 로딩 상태 -->
      <div v-if="loading" class="loading-state card">
        <div class="spinner"></div>
        <p>레시피를 검색하고 있습니다...</p>
        <p class="loading-hint">(최대 30초 정도 소요될 수 있습니다)</p>
      </div>

      <!-- 검색 결과 카드 -->
      <section
        v-if="searched && !loading"
        class="card results-card"
      >
        <div class="section-header">
          <h3 class="section-title">
            🍽️ 검색 결과
            <span class="count-badge">{{ recipes.length }}개</span>
          </h3>

          <input
            v-if="recipes.length > 0"
            class="search-input"
            placeholder="레시피 제목 또는 재료 검색..."
            v-model="searchQuery"
          />
        </div>

        <div v-if="recipes.length === 0" class="empty-result">
          <p>😢 선택한 재료로 만들 수 있는 레시피를 찾지 못했습니다.</p>
          <p class="hint">다른 재료 조합을 시도해보세요!</p>
        </div>

        <div v-else class="recipes-list">
          <article
            v-for="recipe in filteredRecipes"
            :key="recipe.url"
            class="recipe-item"
          >
            <div class="recipe-thumbnail">
              <img
                v-if="recipe.image"
                :src="recipe.image"
                :alt="recipe.title"
                @error="
                  (e) =>
                    ((e.target as HTMLImageElement).src =
                      'https://via.placeholder.com/400x240?text=No+Image')
                "
              />
              <div v-else class="no-image">🍳</div>
            </div>

            <div class="recipe-body">
              <h4 class="recipe-title">
                {{ recipe.title }}
              </h4>

              <div class="recipe-meta">
                <span class="reviews">👍 {{ recipe.reviews.toLocaleString() }}</span>
                <span
                  v-if="recipe.need.length === 0"
                  class="badge badge-ready"
                >
                  🎉 지금 바로 가능
                </span>
              </div>

              <div class="ingredient-section">
                <div class="ingredient-label">
                  ✅ 보유 재료 ({{ recipe.have.length }})
                </div>
                <div class="ingredient-tags">
                  <span
                    v-for="ing in recipe.have"
                    :key="ing"
                    class="tag tag-have"
                  >
                    {{ ing }}
                  </span>
                </div>
              </div>

              <div
                v-if="recipe.need.length > 0"
                class="ingredient-section"
              >
                <div class="ingredient-label">
                  ❌ 부족 재료 ({{ recipe.need.length }})
                </div>
                <div class="ingredient-tags">
                  <span
                    v-for="ing in recipe.need"
                    :key="ing"
                    class="tag tag-need"
                  >
                    {{ ing }}
                  </span>
                </div>
              </div>

              <button
                class="btn-outline"
                @click="openRecipeDetail(recipe)"
              >
                레시피 자세히 보기 📖
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- 레시피 상세보기 모달 -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="modal-overlay"
        @click="closeModal"
      >
        <div class="modal-content" @click.stop>
          <div
            v-if="modalLoading"
            class="modal-loading"
          >
            <div class="spinner"></div>
            <p>레시피 정보를 불러오는 중...</p>
          </div>

          <div
            v-else-if="selectedRecipe"
            class="recipe-detail"
          >
            <header class="modal-header">
              <h2>{{ selectedRecipe.title }}</h2>
              <button
                class="close-btn"
                @click="closeModal"
              >
                ✕
              </button>
            </header>

            <div
              v-if="selectedRecipe.image"
              class="detail-image"
            >
              <img
                :src="selectedRecipe.image"
                :alt="selectedRecipe.title"
              />
            </div>

            <!-- 건강 정보 섹션 -->
            <section class="detail-section health-section">
              <h3>💊 영양 정보</h3>

              <div
                v-if="healthLoading"
                class="health-loading"
              >
                <div class="small-spinner"></div>
                <span>영양 정보 분석 중...</span>
              </div>

              <div
                v-else-if="healthInfo"
                class="health-info-grid"
              >
                <div class="health-item">
                  <div class="health-icon">🔥</div>
                  <div class="health-data">
                    <div class="health-label">칼로리</div>
                    <div class="health-value">
                      {{ healthInfo.총칼로리.toFixed(0) }} kcal
                    </div>
                  </div>
                </div>

                <div class="health-item">
                  <div class="health-icon">🍚</div>
                  <div class="health-data">
                    <div class="health-label">탄수화물</div>
                    <div class="health-value">
                      {{ healthInfo.탄수화물.toFixed(1) }} g
                    </div>
                  </div>
                </div>

                <div class="health-item">
                  <div class="health-icon">🍭</div>
                  <div class="health-data">
                    <div class="health-label">당류</div>
                    <div class="health-value">
                      {{ healthInfo.당류.toFixed(1) }} g
                    </div>
                  </div>
                </div>

                <div class="health-item">
                  <div class="health-icon">🥑</div>
                  <div class="health-data">
                    <div class="health-label">지방</div>
                    <div class="health-value">
                      {{ healthInfo.지방.toFixed(1) }} g
                    </div>
                  </div>
                </div>

                <div class="health-item">
                  <div class="health-icon">🥩</div>
                  <div class="health-data">
                    <div class="health-label">단백질</div>
                    <div class="health-value">
                      {{ healthInfo.단백질.toFixed(1) }} g
                    </div>
                  </div>
                </div>

                <div class="health-item">
                  <div class="health-icon">🧂</div>
                  <div class="health-data">
                    <div class="health-label">나트륨</div>
                    <div class="health-value">
                      {{ healthInfo.나트륨.toFixed(1) }} mg
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-else
                class="health-unavailable"
              >
                영양 정보를 가져올 수 없습니다.
              </div>
            </section>

            <section class="detail-section">
              <h3>🥘 필요한 재료</h3>
              <ul class="ingredients-list">
                <li
                  v-for="(ing, idx) in selectedRecipe.ingredients"
                  :key="idx"
                >
                  {{ ing }}
                </li>
              </ul>
            </section>

            <section class="detail-section">
              <h3>👨‍🍳 조리 순서</h3>
              <ol class="steps-list">
                <li
                  v-for="(step, idx) in selectedRecipe.steps"
                  :key="idx"
                >
                  {{ step }}
                </li>
              </ol>
            </section>

            <section
              v-if="selectedRecipe.tips"
              class="detail-section"
            >
              <h3>💡 조리 팁</h3>
              <p class="tips-text">
                {{ selectedRecipe.tips }}
              </p>
            </section>

            <footer class="modal-footer">
              <a
                :href="selectedRecipe.url"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-primary"
              >
                원본 레시피 보러가기 →
              </a>
            </footer>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* 페이지 전체 */
.recipes-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #fafafa;
}

/* 내부 스크롤 영역 */
.recipes-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* 카드 공통 */
.card {
  background: #ffffff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.07);
  margin-bottom: 18px;
}

/* 페이지 헤더 */
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 6px;
  color: #333;
}

.page-subtitle {
  font-size: 14px;
  color: #777;
  margin-bottom: 16px;
}

/* 에러 메시지 */
.error-banner {
  background: #ffe5e5;
  color: #c62828;
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 500;
}

/* 섹션 헤더 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #444;
}

.count-badge {
  background: #e8f3ff;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 13px;
  margin-left: 6px;
}

/* 버튼 모음 */
.btn-primary {
  width: 100%;
  background: #4e91ff;
  color: white;
  padding: 12px;
  border-radius: 10px;
  border: none;
  font-weight: 600;
  font-size: 15px;
  margin-top: 14px;
  cursor: pointer;
  transition: 0.1s;
}
.btn-primary:disabled {
  background: #aac8ff;
}
.btn-primary:active {
  transform: scale(0.98);
}

.btn-secondary {
  background: #f2f3f5;
  color: #444;
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.btn-secondary.small {
  padding: 4px 10px;
  font-size: 12px;
}

.btn-outline {
  width: 100%;
  border: 1.6px solid #4e91ff;
  background: #f8fbff;
  color: #2765cf;
  padding: 10px;
  border-radius: 10px;
  font-size: 14px;
  margin-top: 10px;
  font-weight: 600;
}

/* 재료 카드 그리드 */
.ingredients-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.ingredient-card {
  background: #f6faff;
  padding: 12px;
  border-radius: 10px;
  border: 1.5px solid #e1ecff;
  cursor: pointer;
  position: relative;
  transition: 0.15s;
}
.ingredient-card.selected {
  background: #e8f1ff;
  border-color: #4e91ff;
}
.ingredient-card.expired {
  opacity: 0.55;
}
.ingredient-card.urgent {
  border-color: #ff5252;
}
.ingredient-card.warning {
  border-color: #ffa726;
}

.ingredient-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
}

.ingredient-info {
  font-size: 12px;
  color: #777;
  display: flex;
  justify-content: space-between;
}

.check-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #4e91ff;
  color: white;
  font-size: 11px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 결과 검색 input */
.search-input {
  width: 160px;
  padding: 8px;
  border: 1.5px solid #d4dcee;
  border-radius: 8px;
  font-size: 13px;
}

/* 레시피 리스트 */
.recipes-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.recipe-item {
  background: #fff;
  border: 1.4px solid #e5e8ef;
  border-radius: 12px;
  overflow: hidden;
}

.recipe-thumbnail img,
.detail-image img {
  width: 100%;
  border-bottom: 1px solid #eee;
}

.recipe-body {
  padding: 12px;
}

.recipe-title {
  font-size: 16px;
  font-weight: 700;
  color: #333;
  line-height: 1.3;
  margin-bottom: 6px;
}

.recipe-meta {
  font-size: 13px;
  margin-bottom: 8px;
  color: #666;
  display: flex;
  justify-content: space-between;
}

.badge-ready {
  background: #e1ffd9;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
}

/* 태그 */
.ingredient-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 8px;
  font-weight: 500;
}

.tag-have {
  background: #e9f4ff;
  color: #1976d2;
}

.tag-need {
  background: #ffeaea;
  color: #d32f2f;
}

/* 모달 */
.modal-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(2px);
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  padding: 20px;
  z-index: 3000;
}

.modal-content {
  background: #ffffff;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 16px;
  padding: 18px;
  position: relative;
  animation: popup 0.15s ease;
}

@keyframes popup {
  from {
    transform: scale(0.96);
    opacity: 0.3;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* 모달 헤더 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 22px;
  color: #777;
}

/* 건강 정보 */
.health-section {
  margin-top: 16px;
}

.health-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 13px;
}

.small-spinner {
  width: 16px;
  height: 16px;
  border: 2.2px solid #cfd8dc;
  border-top-color: #4e91ff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.health-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.health-item {
  display: flex;
  gap: 10px;
  background: #f8fbff;
  border: 1.5px solid #e0ebff;
  padding: 10px;
  border-radius: 10px;
}

.health-icon {
  font-size: 18px;
}

.health-label {
  font-size: 12px;
  color: #777;
}

.health-value {
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

/* 모달 내부 섹션 */
.detail-section {
  margin-top: 18px;
}

.ingredients-list li,
.steps-list li {
  font-size: 14px;
  margin-bottom: 6px;
  color: #444;
  line-height: 1.45;
}

/* 모달 footer */
.modal-footer {
  margin-top: 20px;
  text-align: center;
}

.modal-footer .btn-primary {
  width: auto;
  padding: 10px 20px;
}

/* 로딩 스피너 */
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #dfe8ff;
  border-top-color: #4e91ff;
  border-radius: 50%;
  margin: 0 auto 10px;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
