<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { listInventory } from '@/api'
import { API_BASE } from '@/config/api'

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

type CookedMeal = {
  cooked_meal_id: number
  recipe_title: string
  recipe_url: string
  remaining_portions: number
  cooked_date: string
  calories_per_portion: number
  carbs_per_portion: number
  protein_per_portion: number
  fat_per_portion: number
}

const cookedMeals = ref<CookedMeal[]>([])


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
const EXPRESS_URL = API_BASE

// 모달 관련
const showModal = ref(false)
const modalLoading = ref(false)
const selectedRecipe = ref<RecipeDetail | null>(null)
const healthInfo = ref<HealthInfo | null>(null)
const healthLoading = ref(false)
// 먹은 음식 추가 모달
const showIntakeModal = ref(false)
const intakeLoading = ref(false)
const intakeSuccess = ref(false)

const userId = computed(() => {
  const id = localStorage.getItem('user_id')
  return id ? parseInt(id) : null
})


// 재고 불러오기
onMounted(async () => {
  try {
    inventory.value = await listInventory()
    await loadCookedMeals()
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
    const selectedArray = Array.from(selectedIngredients.value)
    
    // 전체 재고 목록 (보유한 모든 재료)
    const allInventoryItems = inventory.value.map(item => item.item_name)
    
    const response = await fetch(`${EXPRESS_URL}/recipes/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: selectedArray,  // 검색용: 선택한 재료
        limit: 5,
        userId: userId.value
      })
    })

    if (!response.ok) {
      throw new Error(`서버 오류: ${response.status}`)
    }

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    // 전체 재고 기준으로 재계산
    const processedRecipes = (data.recipes || []).map((recipe: any) => {
      const allIngredients: string[] = recipe.ingredients || []
      
      // 보유한 재료 (전체 재고 기준)
      const have = allIngredients.filter((ing: string) => 
        allInventoryItems.some(inventoryItem => 
          ing.includes(inventoryItem) || inventoryItem.includes(ing)
        )
      )
      
      // 부족한 재료
      const need = allIngredients.filter((ing: string) => 
        !allInventoryItems.some(inventoryItem => 
          ing.includes(inventoryItem) || inventoryItem.includes(ing)
        )
      )
      
      return {
        ...recipe,
        have,
        need
      }
    })

    recipes.value = processedRecipes
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


// 먹은 음식 추가 모달 열기
function openIntakeModal() {
  if (!healthInfo.value) {
    alert('영양 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
    return
  }
  showIntakeModal.value = true
  intakeSuccess.value = false
}

// 먹은 음식 추가 모달 닫기
function closeIntakeModal() {
  showIntakeModal.value = false
  intakeSuccess.value = false
}

// 먹은 음식 추가 (영양 정보만 기록)
async function addIntake(portion: number) {
  if (!selectedRecipe.value || !healthInfo.value) return

  intakeLoading.value = true

  try {
    const userIdValue = userId.value
    if (!userIdValue) return
    const today = new Date().toISOString().split('T')[0]
    
    // 먹은 음식 기록
    const response = await fetch(`${EXPRESS_URL}/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userIdValue,
        meal_name: selectedRecipe.value.title,
        calories: healthInfo.value.총칼로리 * portion,
        carbs: healthInfo.value.탄수화물 * portion,
        protein: healthInfo.value.단백질 * portion,
        fat: healthInfo.value.지방 * portion,
        intake_date: today
      })
    })

    if (!response.ok) {
      throw new Error('먹은 음식 추가에 실패했습니다.')
    }

    // 🆕 1인분 전체를 먹지 않았다면 cooked_meals에 저장
    if (portion < 1) {
      const remaining = 1 - portion
      
      await fetch(`${EXPRESS_URL}/cooked-meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userIdValue,
          recipe_title: selectedRecipe.value.title,
          recipe_url: selectedRecipe.value.url,
          total_portions: 1,
          remaining_portions: remaining,
          cooked_date: today,
          calories_per_portion: healthInfo.value.총칼로리,
          carbs_per_portion: healthInfo.value.탄수화물,
          protein_per_portion: healthInfo.value.단백질,
          fat_per_portion: healthInfo.value.지방
        })
      })
      
      // 남은 음식 목록 새로고침
      await loadCookedMeals()
    }

    intakeSuccess.value = true
    setTimeout(() => {
      closeIntakeModal()
    }, 1500)
  } catch (e: any) {
    console.error('먹은 음식 추가 실패:', e)
    alert(e.message || '먹은 음식 추가에 실패했습니다.')
  } finally {
    intakeLoading.value = false
  }
}
// 남은 음식 불러오기
async function loadCookedMeals() {
  try {
    const userIdValue = userId.value
    if (!userIdValue) return
    
    const response = await fetch(`${EXPRESS_URL}/cooked-meals/${userIdValue}`)
    
    if (response.ok) {
      const data = await response.json()
      cookedMeals.value = data
    }
  } catch (e) {
    console.error('남은 음식 로드 실패:', e)
  }
}

// 남은 음식 섭취
async function eatLeftover(meal: CookedMeal) {
  showIntakeModal.value = true
  intakeSuccess.value = false
  
  // 현재 선택된 레시피를 임시로 저장
  selectedRecipe.value = {
    title: meal.recipe_title,
    url: meal.recipe_url,
    image: null,
    ingredients: [],
    steps: []
  }
  
  // 건강 정보를 1인분 기준으로 설정
  healthInfo.value = {
    총칼로리: meal.calories_per_portion,
    탄수화물: meal.carbs_per_portion,
    당류: 0,
    지방: meal.fat_per_portion,
    단백질: meal.protein_per_portion,
    나트륨: 0
  }
}

async function deleteCookedMeal(mealId: number) {
  if (!confirm('이 음식을 삭제하시겠습니까?')) return
  
  try {
    const response = await fetch(`${EXPRESS_URL}/cooked-meals/${mealId}`, {
      method: 'DELETE'
    })
    
    if (response.ok) {
      await loadCookedMeals()
    }
  } catch (e) {
    console.error('삭제 실패:', e)
    alert('삭제에 실패했습니다.')
  }
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
      <div v-if="showModal" class="modal-overlay" @click="closeModal">
        <div class="modal-content" @click.stop>
          <div
            v-if="modalLoading"
            class="modal-loading"
          >
            <div class="loading-animation">
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
              <div class="spinner-ring"></div>
            </div>
            <p class="loading-text">레시피 정보를 불러오는 중...</p>
          </div>

          <div
            v-else-if="selectedRecipe"
            class="recipe-detail"
          >
            <!-- 히어로 이미지 섹션 -->
            <div class="hero-section">
              <button
                class="close-btn"
                @click="closeModal"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <div
                v-if="selectedRecipe.image"
                class="hero-image"
              >
                <img
                  :src="selectedRecipe.image"
                  :alt="selectedRecipe.title"
                />
                <div class="hero-overlay"></div>
              </div>
              <div v-else class="hero-placeholder">
                <span class="hero-emoji">🍳</span>
              </div>
              <div class="hero-title-wrap">
                <h2 class="hero-title">{{ selectedRecipe.title }}</h2>
              </div>
            </div>

            <div class="modal-body">
              <!-- 영양 정보 섹션 -->
              <section class="nutrition-section">
                <div class="section-header-row">
                  <div class="section-icon">🍽️</div>
                  <h3 class="section-title-text">영양 정보</h3>
                </div>

                <div
                  v-if="healthLoading"
                  class="nutrition-loading"
                >
                  <div class="pulse-loader"></div>
                  <span>영양 정보 분석 중...</span>
                </div>

                <div
                  v-else-if="healthInfo"
                  class="nutrition-grid"
                >
                  <div class="nutrition-card calories">
                    <div class="nutrition-icon-wrap">
                      <span class="nutrition-emoji">🔥</span>
                    </div>
                    <div class="nutrition-info">
                      <span class="nutrition-label">칼로리</span>
                      <span class="nutrition-value">{{ healthInfo.총칼로리.toFixed(0) }}<small>kcal</small></span>
                    </div>
                  </div>

                  <div class="nutrition-card carbs">
                    <div class="nutrition-icon-wrap">
                      <span class="nutrition-emoji">🍚</span>
                    </div>
                    <div class="nutrition-info">
                      <span class="nutrition-label">탄수화물</span>
                      <span class="nutrition-value">{{ healthInfo.탄수화물.toFixed(1) }}<small>g</small></span>
                    </div>
                  </div>

                  <div class="nutrition-card sugar">
                    <div class="nutrition-icon-wrap">
                      <span class="nutrition-emoji">🍭</span>
                    </div>
                    <div class="nutrition-info">
                      <span class="nutrition-label">당류</span>
                      <span class="nutrition-value">{{ healthInfo.당류.toFixed(1) }}<small>g</small></span>
                    </div>
                  </div>

                  <div class="nutrition-card fat">
                    <div class="nutrition-icon-wrap">
                      <span class="nutrition-emoji">🥑</span>
                    </div>
                    <div class="nutrition-info">
                      <span class="nutrition-label">지방</span>
                      <span class="nutrition-value">{{ healthInfo.지방.toFixed(1) }}<small>g</small></span>
                    </div>
                  </div>

                  <div class="nutrition-card protein">
                    <div class="nutrition-icon-wrap">
                      <span class="nutrition-emoji">🥩</span>
                    </div>
                    <div class="nutrition-info">
                      <span class="nutrition-label">단백질</span>
                      <span class="nutrition-value">{{ healthInfo.단백질.toFixed(1) }}<small>g</small></span>
                    </div>
                  </div>

                  <div class="nutrition-card sodium">
                    <div class="nutrition-icon-wrap">
                      <span class="nutrition-emoji">🧂</span>
                    </div>
                    <div class="nutrition-info">
                      <span class="nutrition-label">나트륨</span>
                      <span class="nutrition-value">{{ healthInfo.나트륨.toFixed(1) }}<small>mg</small></span>
                    </div>
                  </div>
                </div>

                <div
                  v-else
                  class="nutrition-unavailable"
                >
                  <span class="unavailable-icon">📊</span>
                  <span>영양 정보를 가져올 수 없습니다</span>
                </div>
              </section>

              <!-- 재료 섹션 -->
              <section class="ingredients-section">
                <div class="section-header-row">
                  <div class="section-icon">🥘</div>
                  <h3 class="section-title-text">필요한 재료</h3>
                  <span class="ingredient-count">{{ selectedRecipe.ingredients.length }}가지</span>
                </div>
                <div class="ingredients-grid-new">
                  <div
                    v-for="(ing, idx) in selectedRecipe.ingredients"
                    :key="idx"
                    class="ingredient-chip"
                  >
                    <span class="ingredient-bullet">•</span>
                    <span class="ingredient-text">{{ ing }}</span>
                  </div>
                </div>
              </section>

              <!-- 조리 순서 섹션 -->
              <section class="steps-section">
                <div class="section-header-row">
                  <div class="section-icon">👨‍🍳</div>
                  <h3 class="section-title-text">조리 순서</h3>
                </div>
                <div class="steps-timeline">
                  <div
                    v-for="(step, idx) in selectedRecipe.steps"
                    :key="idx"
                    class="step-card"
                  >
                    <div class="step-number">{{ idx + 1 }}</div>
                    <div class="step-connector" v-if="idx < selectedRecipe.steps.length - 1"></div>
                    <div class="step-content">
                      <p class="step-text">{{ step }}</p>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 조리 팁 섹션 -->
              <section
                v-if="selectedRecipe.tips"
                class="tips-section"
              >
                <div class="tips-card">
                  <div class="tips-header">
                    <span class="tips-icon">💡</span>
                    <h3 class="tips-title">조리 팁</h3>
                  </div>
                  <p class="tips-content">
                    {{ selectedRecipe.tips }}
                  </p>
                </div>
              </section>

              <!-- 푸터 버튼 -->
              <footer class="modal-footer-new">
                <button
                  class="add-intake-btn full-width"
                  @click="openIntakeModal"
                  :disabled="!healthInfo"
                >
                  <span class="btn-icon">✨</span>
                  <span class="btn-text">먹은 음식에 추가하기</span>
                </button>
                
                <a
                  :href="selectedRecipe.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="original-link-btn"
                >
                  <span class="btn-text">원본 레시피 보기</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7,7 17,7 17,17"></polyline>
                  </svg>
                </a>
              </footer>
            </div>
          </div>
        </div>
      </div>
      <!-- 먹은 음식 추가 모달 -->
      <div
        v-if="showIntakeModal"
        class="modal-overlay intake-modal-overlay"
        @click="closeIntakeModal"
      >
        <div class="intake-modal" @click.stop>
          <div v-if="!intakeSuccess" class="intake-content">
            <h3 class="intake-title">🍽️ 얼마나 드셨나요?</h3>
            <p class="intake-subtitle">섭취량을 선택해주세요</p>
            
            <div class="portion-buttons">
              <button
                class="portion-btn"
                @click="addIntake(0.25)"
                :disabled="intakeLoading"
              >
                <span class="portion-icon">🍴</span>
                <span class="portion-label">1/4</span>
                <span class="portion-desc">조금</span>
              </button>

              <button
                class="portion-btn"
                @click="addIntake(0.33)"
                :disabled="intakeLoading"
              >
                <span class="portion-icon">🥄</span>
                <span class="portion-label">1/3</span>
                <span class="portion-desc">적당히</span>
              </button>

              <button
                class="portion-btn"
                @click="addIntake(0.5)"
                :disabled="intakeLoading"
              >
                <span class="portion-icon">🥗</span>
                <span class="portion-label">1/2</span>
                <span class="portion-desc">반</span>
              </button>

              <button
                class="portion-btn"
                @click="addIntake(1)"
                :disabled="intakeLoading"
              >
                <span class="portion-icon">🍽️</span>
                <span class="portion-label">전부</span>
                <span class="portion-desc">완전</span>
              </button>
            </div>

            <button
              class="cancel-btn"
              @click="closeIntakeModal"
              :disabled="intakeLoading"
            >
              취소
            </button>
          </div>

          <div v-else class="success-content">
            <div class="success-icon">✅</div>
            <p class="success-message">먹은 음식에 추가되었습니다!</p>
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
/* 남은 음식 카드 */
.leftover-card {
  background: #fff8e1;
  border: 2px solid #ffd54f;
}

.leftover-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.leftover-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px;
  background: white;
  border-radius: 10px;
  border: 1.5px solid #ffecb3;
  transition: all 0.2s;
}

.leftover-item:hover {
  border-color: #ffc107;
  transform: translateX(4px);
}

.leftover-info {
  flex: 1;
}

.leftover-title {
  font-weight: 600;
  font-size: 15px;
  color: #333;
  margin-bottom: 6px;
}

.leftover-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
}

.remaining {
  font-weight: 600;
  color: #f57c00;
}

.leftover-actions {
  display: flex;
  gap: 8px;
}

.btn-eat {
  padding: 8px 16px;
  background: #4e91ff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-eat:hover {
  background: #2765cf;
  transform: translateY(-1px);
}

.btn-delete-leftover {
  padding: 8px 12px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete-leftover:hover {
  background: #dc2626;
  transform: scale(1.05);
}

/* 먹은 음식 추가 버튼 전체 너비 */
.add-intake-btn.full-width {
  flex: none;
  width: 100%;
  margin-bottom: 12px;
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

/* ================================
   레시피 상세 모달 - 새로운 디자인
   ================================ */

/* 모달 오버레이 */
.modal-overlay {
  position: fixed;
  inset: 0;
  backdrop-filter: blur(8px);
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
  z-index: 3000;
  overflow-y: auto;
}

.modal-content {
  background: #ffffff;
  width: 100%;
  max-width: 440px;
  max-height: 92vh;
  overflow-y: auto;
  overflow-x: hidden;
  border-radius: 24px;
  position: relative;
  animation: modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-content::-webkit-scrollbar {
  width: 6px;
}

.modal-content::-webkit-scrollbar-track {
  background: transparent;
}

.modal-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 3px;
}

@keyframes modalSlideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* 모달 로딩 */
.modal-loading {
  padding: 60px 20px;
  text-align: center;
}

.loading-animation {
  position: relative;
  width: 50px;
  height: 50px;
  margin: 0 auto 20px;
}

.spinner-ring {
  position: absolute;
  inset: 0;
  border: 3px solid transparent;
  border-radius: 50%;
  animation: spinMulti 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

.spinner-ring:nth-child(1) {
  border-top-color: #6366f1;
  animation-delay: -0.3s;
}

.spinner-ring:nth-child(2) {
  border-top-color: #8b5cf6;
  animation-delay: -0.15s;
  inset: 4px;
}

.spinner-ring:nth-child(3) {
  border-top-color: #a78bfa;
  inset: 8px;
}

@keyframes spinMulti {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
}

/* 히어로 섹션 */
.hero-section {
  position: relative;
  width: 100%;
  min-height: 220px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

.hero-image {
  position: relative;
  width: 100%;
  height: 240px;
}

.hero-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 40%,
    rgba(0, 0, 0, 0.7) 100%
  );
}

.hero-placeholder {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hero-emoji {
  font-size: 64px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}

.hero-title-wrap {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20px;
  background: linear-gradient(to top, rgba(0,0,0,0.75), transparent);
}

.hero-title {
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  margin: 0;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.95);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.close-btn:hover {
  background: #fff;
  transform: scale(1.05);
}

.close-btn svg {
  color: #374151;
}

/* 모달 바디 */
.modal-body {
  padding: 20px;
}

/* 섹션 헤더 */
.section-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.section-icon {
  font-size: 22px;
}

.section-title-text {
  font-size: 17px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  flex: 1;
}

/* 영양 정보 섹션 */
.nutrition-section {
  margin-bottom: 28px;
}

.nutrition-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
  color: #64748b;
  font-size: 14px;
}

.pulse-loader {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1); opacity: 1; }
}

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.nutrition-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  transition: all 0.2s ease;
}

.nutrition-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.nutrition-card.calories {
  background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
  border-color: #fcd34d;
}

.nutrition-card.carbs {
  background: linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%);
  border-color: #93c5fd;
}

.nutrition-card.sugar {
  background: linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%);
  border-color: #f9a8d4;
}

.nutrition-card.fat {
  background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
  border-color: #6ee7b7;
}

.nutrition-card.protein {
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  border-color: #fca5a5;
}

.nutrition-card.sodium {
  background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
  border-color: #a5b4fc;
}

.nutrition-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nutrition-emoji {
  font-size: 18px;
}

.nutrition-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.nutrition-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
  margin-bottom: 2px;
}

.nutrition-value {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.nutrition-value small {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
}

.nutrition-unavailable {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  background: #f8fafc;
  border-radius: 12px;
  color: #94a3b8;
  font-size: 14px;
}

.unavailable-icon {
  font-size: 20px;
}

/* 재료 섹션 */
.ingredients-section {
  margin-bottom: 28px;
}

.ingredient-count {
  font-size: 13px;
  color: #6366f1;
  background: #eef2ff;
  padding: 4px 10px;
  border-radius: 20px;
  font-weight: 600;
}

.ingredients-grid-new {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ingredient-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  font-size: 13px;
  color: #475569;
  transition: all 0.2s ease;
}

.ingredient-chip:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.ingredient-bullet {
  color: #6366f1;
  font-weight: bold;
}

.ingredient-text {
  font-weight: 500;
}

/* 조리 순서 섹션 */
.steps-section {
  margin-bottom: 28px;
}

.steps-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.step-card {
  display: flex;
  gap: 14px;
  position: relative;
  padding-bottom: 20px;
}

.step-card:last-child {
  padding-bottom: 0;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
}

.step-connector {
  position: absolute;
  left: 15px;
  top: 32px;
  width: 2px;
  height: calc(100% - 32px);
  background: linear-gradient(to bottom, #c7d2fe, #e0e7ff);
  z-index: 1;
}

.step-content {
  flex: 1;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
  transition: all 0.2s ease;
}

.step-content:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.step-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  margin: 0;
  word-break: keep-all;
}

/* 조리 팁 섹션 */
.tips-section {
  margin-bottom: 24px;
}

.tips-card {
  background: linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%);
  border: 1px solid #fcd34d;
  border-radius: 16px;
  padding: 16px 18px;
}

.tips-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.tips-icon {
  font-size: 22px;
}

.tips-title {
  font-size: 15px;
  font-weight: 700;
  color: #92400e;
  margin: 0;
}

.tips-content {
  font-size: 14px;
  color: #78350f;
  line-height: 1.65;
  margin: 0;
  word-break: keep-all;
}

/* 모달 푸터 */
.modal-footer-new {
  padding-top: 8px;
}

.original-link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 20px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: #fff;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
}

.original-link-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
}

.original-link-btn:active {
  transform: translateY(0);
}

.original-link-btn svg {
  flex-shrink: 0;
}

/* 로딩 스피너 (기존 호환) */
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
/* 먹은 음식 추가 버튼 */
.modal-footer-new {
  display: flex;
  gap: 12px;
  margin-top: 32px;
}

.add-intake-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.add-intake-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
}

.add-intake-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 20px;
}

.original-link-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px 24px;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  color: #334155;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.original-link-btn:hover {
  border-color: #667eea;
  color: #667eea;
  transform: translateY(-2px);
}

/* 먹은 음식 추가 모달 */
.intake-modal-overlay {
  z-index: 7000;
}

.intake-modal {
  background: white;
  border-radius: 24px;
  padding: 32px;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.intake-content {
  text-align: center;
}

.intake-title {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}

.intake-subtitle {
  font-size: 16px;
  color: #64748b;
  margin-bottom: 32px;
}

.portion-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.portion-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.portion-btn:hover:not(:disabled) {
  border-color: #667eea;
  background: #f8f9ff;
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.15);
}

.portion-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.portion-icon {
  font-size: 36px;
}

.portion-label {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
}

.portion-desc {
  font-size: 14px;
  color: #64748b;
}

.cancel-btn {
  width: 100%;
  padding: 14px;
  background: #f1f5f9;
  border: none;
  border-radius: 12px;
  color: #64748b;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover:not(:disabled) {
  background: #e2e8f0;
}

.success-content {
  text-align: center;
  padding: 20px;
}

.success-icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 0.6s ease;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.success-message {
  font-size: 20px;
  font-weight: 600;
  color: #10b981;
}
</style>