<script setup>
import { reactive, ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/api'
import { getInventory } from '@/api/index.ts'

const router = useRouter()

// 권장 섭취량 기준
const DAILY_STANDARDS = {
  calories: 2000,
  carbs: 300,
  protein: 48,
  fat: 60
}

const health = reactive({
  height: '',
  weight: '',
  age: '',
  gender: '',
  targetWeight: ''
})

const hasProfile = ref(false)
const loading = ref(true)
const saving = ref(false)
const userInfo = ref(null)
const showEditModal = ref(false)

// 식사 기록 관련
const showMealModal = ref(false)
const inventoryList = ref([])
const selectedItems = ref([]) // [{ inventory_id, item_id, item_name, quantity, calories, carbs, protein, fat }]
const mealName = ref('')
const savingMeal = ref(false)

// 오늘의 섭취 데이터
const todayIntake = ref({
  calories: 0,
  carbs: 0,
  protein: 0,
  fat: 0
})

// 몸무게 기록 (2주간)
const weightRecords = ref([])
const todayWeight = ref('')
const savingWeight = ref(false)

// 최근 5일 식단 일기
const recentMeals = ref([])

// 표준 체중 계산
function calculateStdWeight(heightCm) {
  const heightM = heightCm / 100
  return (heightM * heightM * 22).toFixed(1)
}

// 섭취율 계산
const intakePercentages = computed(() => ({
  calories: Math.round((todayIntake.value.calories / DAILY_STANDARDS.calories) * 100),
  carbs: Math.round((todayIntake.value.carbs / DAILY_STANDARDS.carbs) * 100),
  protein: Math.round((todayIntake.value.protein / DAILY_STANDARDS.protein) * 100),
  fat: Math.round((todayIntake.value.fat / DAILY_STANDARDS.fat) * 100)
}))

// 🆕 선택된 아이템 총 영양소 계산
const totalNutrients = computed(() => {
  return selectedItems.value.reduce((acc, item) => ({
    calories: acc.calories + (item.calories * item.quantity),
    carbs: acc.carbs + (item.carbs * item.quantity),
    protein: acc.protein + (item.protein * item.quantity),
    fat: acc.fat + (item.fat * item.quantity)
  }), { calories: 0, carbs: 0, protein: 0, fat: 0 })
})

// 몸무게 그래프 데이터
const weightChartData = computed(() => {
  if (weightRecords.value.length === 0) return { labels: [], current: [], target: [] }
  
  const sorted = [...weightRecords.value].sort((a, b) => 
    new Date(a.record_date) - new Date(b.record_date)
  )
  
  return {
    labels: sorted.map(r => {
      const date = new Date(r.record_date)
      return `${date.getMonth() + 1}/${date.getDate()}`
    }),
    current: sorted.map(r => r.weight),
    target: sorted.map(() => userInfo.value?.target_weight || 0)
  }
})

// 건강 프로필 불러오기
async function loadHealthProfile() {
  loading.value = true
  try {
    const userId = localStorage.getItem('user_id') || 1
    const response = await fetch(`${API_BASE}/users/${userId}`)
    
    if (!response.ok) throw new Error('프로필 로드 실패')
    
    const data = await response.json()
    userInfo.value = data
    
    if (data.height && data.weight && data.age && data.gender) {
      hasProfile.value = true
      health.height = data.height
      health.weight = data.weight
      health.age = data.age
      health.gender = data.gender
      health.targetWeight = data.target_weight || calculateStdWeight(data.height)
      
      // 건강 데이터 로드
      await Promise.all([
        loadTodayIntake(),
        loadWeightRecords(),
        loadRecentMeals()
      ])
    }
  } catch (error) {
    console.error('프로필 로드 오류:', error)
  } finally {
    loading.value = false
  }
}

// 재고 목록 불러오기
async function loadInventory() {
  try {
    // ✅ API 함수 사용 (userId 자동 처리)
    inventoryList.value = await getInventory()
  } catch (error) {
    console.error('재고 로드 오류:', error)
    alert('재고를 불러오는데 실패했습니다.')
  }
}

// 오늘의 섭취량 불러오기
async function loadTodayIntake() {
  try {
    const userId = localStorage.getItem('user_id') || 1
    const today = new Date().toISOString().split('T')[0]
    const response = await fetch(`${API_BASE}/health/intake/${userId}?date=${today}`)
    
    if (response.ok) {
      const data = await response.json()
      todayIntake.value = data
    }
  } catch (error) {
    console.error('섭취량 로드 오류:', error)
  }
}

// 몸무게 기록 불러오기 (2주간)
async function loadWeightRecords() {
  try {
    const userId = localStorage.getItem('user_id') || 1
    const response = await fetch(`${API_BASE}/health/weight/${userId}`)
    
    if (response.ok) {
      const data = await response.json()
      weightRecords.value = data
      
      // 오늘 기록 있는지 확인
      const today = new Date().toISOString().split('T')[0]
      const todayRecord = data.find(r => r.record_date === today)
      if (todayRecord) {
        todayWeight.value = todayRecord.weight
      }
    }
  } catch (error) {
    console.error('몸무게 기록 로드 오류:', error)
  }
}

// 최근 5일 식단 불러오기
async function loadRecentMeals() {
  try {
    const userId = localStorage.getItem('user_id') || 1
    const response = await fetch(`${API_BASE}/health/meals/${userId}?days=5`)
    
    if (response.ok) {
      const data = await response.json()
      recentMeals.value = data
    }
  } catch (error) {
    console.error('식단 기록 로드 오류:', error)
  }
}

// 오늘 몸무게 저장
async function saveTodayWeight() {
  if (!todayWeight.value || todayWeight.value <= 0) {
    alert('유효한 몸무게를 입력해주세요.')
    return
  }
  
  savingWeight.value = true
  try {
    const userId = localStorage.getItem('user_id') || 1
    const today = new Date().toISOString().split('T')[0]
    
    const response = await fetch(`${API_BASE}/health/weight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        weight: Number(todayWeight.value),
        record_date: today
      })
    })
    
    if (!response.ok) throw new Error('저장 실패')
    
    alert('몸무게가 저장되었습니다!')
    await loadWeightRecords()
  } catch (error) {
    console.error('몸무게 저장 오류:', error)
    alert('저장에 실패했습니다.')
  } finally {
    savingWeight.value = false
  }
}

// 🆕 재고 목록 불러오기
async function loadInventory() {
  try {
    const userId = localStorage.getItem('user_id') || 1
    const response = await fetch(`${API_BASE}/inventory?user_id=${userId}`)
    
    if (!response.ok) throw new Error('재고 조회 실패')
    
    inventoryList.value = await response.json()
  } catch (error) {
    console.error('재고 로드 오류:', error)
    alert('재고를 불러오는데 실패했습니다.')
  }
}

// 🆕 식사 기록 모달 열기
async function openMealModal() {
  await loadInventory()
  selectedItems.value = []
  mealName.value = ''
  showMealModal.value = true
}

// 🆕 식사 기록 모달 닫기
function closeMealModal() {
  showMealModal.value = false
  selectedItems.value = []
  mealName.value = ''
}

// 🆕 재고 아이템 선택/해제
function toggleItem(item) {
  const index = selectedItems.value.findIndex(i => i.inventory_id === item.inventory_id)
  
  if (index > -1) {
    selectedItems.value.splice(index, 1)
  } else {
    selectedItems.value.push({
      inventory_id: item.inventory_id,
      item_id: item.item_id,
      item_name: item.item_name,
      max_quantity: item.quantity,
      quantity: 1,
      calories: item.calories || 0,
      carbs: item.carbs || 0,
      protein: item.protein || 0,
      fat: item.fat || 0
    })
  }
}

// 🆕 아이템이 선택되었는지 확인
function isSelected(inventoryId) {
  return selectedItems.value.some(i => i.inventory_id === inventoryId)
}

// 🆕 수량 변경
function updateQuantity(inventoryId, value) {
  const item = selectedItems.value.find(i => i.inventory_id === inventoryId)
  if (item) {
    const newQty = Math.max(0.1, Math.min(item.max_quantity, Number(value)))
    item.quantity = newQty
  }
}

// 🆕 식사 기록 저장
async function saveMeal() {
  if (selectedItems.value.length === 0) {
    alert('최소 1개 이상의 재료를 선택해주세요.')
    return
  }
  
  if (!mealName.value.trim()) {
    alert('식사 이름을 입력해주세요.')
    return
  }
  
  savingMeal.value = true
  try {
    const userId = localStorage.getItem('user_id') || 1
    const today = new Date().toISOString().split('T')[0]
    
    // 1. 식사 기록 저장
    const nutrients = totalNutrients.value
    const intakeResponse = await fetch(`${API_BASE}/health/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        meal_name: mealName.value,
        calories: nutrients.calories,
        carbs: nutrients.carbs,
        protein: nutrients.protein,
        fat: nutrients.fat,
        intake_date: today
      })
    })
    
    if (!intakeResponse.ok) throw new Error('식사 기록 실패')
    
    // 2. 재고 차감
    for (const item of selectedItems.value) {
      const inventoryItem = inventoryList.value.find(i => i.inventory_id === item.inventory_id)
      const newQuantity = inventoryItem.quantity - item.quantity
      
      if (newQuantity <= 0) {
        // 수량이 0 이하면 삭제
        await fetch(`${API_BASE}/inventory/${item.inventory_id}?user_id=${userId}`, {
          method: 'DELETE'
        })
      } else {
        // 수량 업데이트
        await fetch(`${API_BASE}/inventory/${item.inventory_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            quantity: newQuantity
          })
        })
      }
    }
    
    alert('식사가 기록되었습니다!')
    closeMealModal()
    
    // 데이터 새로고침
    await Promise.all([
      loadTodayIntake(),
      loadRecentMeals()
    ])
  } catch (error) {
    console.error('식사 기록 오류:', error)
    alert('식사 기록에 실패했습니다.')
  } finally {
    savingMeal.value = false
  }
}

// 영양 상태 판정
function getNutrientStatus(actual, standard) {
  const ratio = actual / standard
  if (ratio < 0.8) return { text: '부족', class: 'low' }
  if (ratio > 1.2) return { text: '과다', class: 'high' }
  return { text: '적정', class: 'good' }
}

// 건강 프로필 저장
async function saveHealthProfile() {
  if (!health.height || !health.weight || !health.age || !health.gender) {
    alert('키, 몸무게, 나이, 성별은 필수 입력 항목입니다.')
    return
  }

  const targetWeight = health.targetWeight || calculateStdWeight(health.height)

  saving.value = true
  try {
    const userId = localStorage.getItem('user_id') || 1
    const response = await fetch(`${API_BASE}/users/${userId}/health`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        height: Number(health.height),
        weight: Number(health.weight),
        age: Number(health.age),
        gender: health.gender,
        target_weight: Number(targetWeight)
      })
    })

    if (!response.ok) throw new Error('저장 실패')

    alert('건강 프로필이 저장되었습니다!')
    showEditModal.value = false
    await loadHealthProfile()
  } catch (error) {
    console.error('저장 오류:', error)
    alert('저장에 실패했습니다.')
  } finally {
    saving.value = false
  }
}

// BMI 계산
function calculateBMI() {
  if (!userInfo.value?.height || !userInfo.value?.weight) return null
  const heightM = userInfo.value.height / 100
  const bmi = (userInfo.value.weight / (heightM * heightM)).toFixed(1)
  return bmi
}

// 수정 모드
function openEditModal() {
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  // 원래 값으로 복구
  if (userInfo.value) {
    health.height = userInfo.value.height
    health.weight = userInfo.value.weight
    health.age = userInfo.value.age
    health.gender = userInfo.value.gender
    health.targetWeight = userInfo.value.target_weight
  }
}

// 로그아웃
async function handleLogout() {
  const confirmLogout = confirm('로그아웃하시겠습니까?')
  if (!confirmLogout) return

  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })

    localStorage.clear()
    router.push('/login')
  } catch (error) {
    console.error('로그아웃 실패:', error)
    localStorage.clear()
    router.push('/login')
  }
}

onMounted(() => {
  loadHealthProfile()
})
</script>

<template>
  <div class="health-container">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>로딩 중...</p>
    </div>

    <!-- 프로필 설정 필요 -->
    <div v-else-if="!hasProfile" class="setup-required">
      <div class="setup-card">
        <h2>💪 건강 프로필 설정</h2>
        <p>건강 관리를 시작하기 위해 기본 정보를 입력해주세요</p>
        
        <form class="health-form" @submit.prevent="saveHealthProfile">
          <div class="form-row">
            <div class="form-group">
              <label>키 (cm) *</label>
              <input type="number" v-model="health.height" placeholder="172.5" min="50" max="250" step="0.1" required />
            </div>
            <div class="form-group">
              <label>현재 몸무게 (kg) *</label>
              <input type="number" v-model="health.weight" placeholder="63.2" min="20" max="300" step="0.1" required />
            </div>
          </div>

          <div class="form-group">
            <label>목표 몸무게 (kg)</label>
            <input type="number" v-model="health.targetWeight" :placeholder="health.height ? `표준 체중: ${calculateStdWeight(health.height)} kg` : '입력하지 않으면 표준 체중으로 설정'" min="20" max="300" step="0.1" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>나이 (세) *</label>
              <input type="number" v-model="health.age" placeholder="24" min="5" max="120" required />
            </div>
            <div class="form-group">
              <label>성별 *</label>
              <select v-model="health.gender" required>
                <option value="">선택</option>
                <option value="F">여성</option>
                <option value="M">남성</option>
              </select>
            </div>
          </div>

          <button type="submit" class="btn-save" :disabled="saving">
            {{ saving ? '저장 중...' : '시작하기' }}
          </button>
        </form>
      </div>
    </div>

    <!-- 건강 대시보드 -->
    <div v-else class="dashboard">
      <!-- 상단 헤더 -->
      <div class="header">
        <h2>💪 건강 프로필</h2>
        <button class="btn-settings" @click="openEditModal">⚙️</button>
      </div>

      <!-- 1. 오늘의 영양 섭취 -->
      <div class="card nutrition-card">
        <div class="card-header">
          <div class="title-with-badge">
            <h3 class="card-title">📊 오늘의 영양 섭취</h3>
            <span class="estimate-badge small">추정치</span>
          </div>
          <button class="btn-add-meal" @click="openMealModal">🍽️ 식사 기록</button>
        </div>
        
        <div class="nutrition-circle">
          <div class="circle-main">
            <span class="calories-value">{{ todayIntake.calories }}</span>
            <span class="calories-label">권장칼로리 {{ DAILY_STANDARDS.calories }}kcal</span>
          </div>
        </div>

        <div class="nutrition-bars">
          <div class="nutrition-item">
            <div class="nutrition-header">
              <span class="nutrient-name">탄수화물</span>
              <span class="nutrient-value">{{ todayIntake.carbs.toFixed(1) }}g</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill carbs" :style="{ width: Math.min(intakePercentages.carbs, 100) + '%' }"></div>
            </div>
            <span class="percentage">{{ intakePercentages.carbs }}%</span>
          </div>

          <div class="nutrition-item">
            <div class="nutrition-header">
              <span class="nutrient-name">단백질</span>
              <span class="nutrient-value">{{ todayIntake.protein.toFixed(1) }}g</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill protein" :style="{ width: Math.min(intakePercentages.protein, 100) + '%' }"></div>
            </div>
            <span class="percentage">{{ intakePercentages.protein }}%</span>
          </div>

          <div class="nutrition-item">
            <div class="nutrition-header">
              <span class="nutrient-name">지방</span>
              <span class="nutrient-value">{{ todayIntake.fat.toFixed(1) }}g</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill fat" :style="{ width: Math.min(intakePercentages.fat, 100) + '%' }"></div>
            </div>
            <span class="percentage">{{ intakePercentages.fat }}%</span>
          </div>
        </div>
      </div>

      <!-- 2. 몸무게 기록 추이 -->
      <div class="card weight-card">
        <h3 class="card-title">💪 몸무게 기록 추이</h3>
        
        <div class="weight-input">
          <input type="number" v-model="todayWeight" placeholder="오늘의 몸무게" step="0.1" min="20" max="300" />
          <button @click="saveTodayWeight" :disabled="savingWeight">{{ savingWeight ? '저장 중...' : '기록' }}</button>
        </div>

        <div class="weight-chart" v-if="weightRecords.length > 0">
          <svg viewBox="0 0 400 200" class="chart-svg">
            <!-- 격자선 -->
            <line v-for="i in 5" :key="'grid-' + i" 
              :x1="0" :y1="i * 40" :x2="400" :y2="i * 40" 
              stroke="#f0f0f0" stroke-width="1" />
            
            <!-- 목표 체중 선 -->
            <line 
              :x1="0" 
              :y1="(() => {
                const weights = weightRecords.map(w => w.weight);
                const targetWeight = userInfo.target_weight || 0;
                const minW = Math.min(...weights, targetWeight) - 2;
                const maxW = Math.max(...weights, targetWeight) + 2;
                const range = maxW - minW;
                return 180 - ((targetWeight - minW) / range) * 160;
              })()" 
              :x2="400" 
              :y2="(() => {
                const weights = weightRecords.map(w => w.weight);
                const targetWeight = userInfo.target_weight || 0;
                const minW = Math.min(...weights, targetWeight) - 2;
                const maxW = Math.max(...weights, targetWeight) + 2;
                const range = maxW - minW;
                return 180 - ((targetWeight - minW) / range) * 160;
              })()" 
              stroke="#FFA500" stroke-width="2" stroke-dasharray="5,5" />
            
            <!-- 현재 체중 선 -->
            <polyline 
              :points="weightRecords.map((r, i) => {
                const x = (i / Math.max(weightRecords.length - 1, 1)) * 400;
                const weights = weightRecords.map(w => w.weight);
                const targetWeight = userInfo.target_weight || 0;
                const minW = Math.min(...weights, targetWeight) - 2;
                const maxW = Math.max(...weights, targetWeight) + 2;
                const range = maxW - minW;
                const y = 180 - ((r.weight - minW) / range) * 160;
                return `${x},${y}`;
              }).join(' ')"
              fill="none" stroke="#1976d2" stroke-width="3" />
            
            <!-- 데이터 포인트 -->
            <circle 
              v-for="(r, i) in weightRecords" 
              :key="'point-' + i"
              :cx="(i / Math.max(weightRecords.length - 1, 1)) * 400"
              :cy="(() => {
                const weights = weightRecords.map(w => w.weight);
                const targetWeight = userInfo.target_weight || 0;
                const minW = Math.min(...weights, targetWeight) - 2;
                const maxW = Math.max(...weights, targetWeight) + 2;
                const range = maxW - minW;
                return 180 - ((r.weight - minW) / range) * 160;
              })()"
              r="4"
              fill="#1976d2"
            />
          </svg>
          
          <div class="chart-legend">
            <span><span class="legend-dot current"></span>현재 체중</span>
            <span><span class="legend-dot target"></span>목표 체중 ({{ userInfo.target_weight }}kg)</span>
          </div>
        </div>
        
        <div v-else class="no-data">아직 기록된 몸무게가 없습니다</div>
      </div>

      <!-- 3. 최근 5일 식단 일기 -->
      <div class="card meals-card">
        <h3 class="card-title">📅 최근 5일 식단 일기</h3>
        
        <div v-if="recentMeals.length > 0" class="meals-grid">
          <div v-for="meal in recentMeals" :key="meal.date" class="meal-day">
            <div class="meal-date">{{ new Date(meal.date).getMonth() + 1 }}/{{ new Date(meal.date).getDate() }}</div>
            <div class="meal-nutrients">
              <div class="nutrient-badge" :class="getNutrientStatus(meal.carbs, DAILY_STANDARDS.carbs).class">
                탄: {{ getNutrientStatus(meal.carbs, DAILY_STANDARDS.carbs).text }}
              </div>
              <div class="nutrient-badge" :class="getNutrientStatus(meal.protein, DAILY_STANDARDS.protein).class">
                단: {{ getNutrientStatus(meal.protein, DAILY_STANDARDS.protein).text }}
              </div>
              <div class="nutrient-badge" :class="getNutrientStatus(meal.fat, DAILY_STANDARDS.fat).class">
                지: {{ getNutrientStatus(meal.fat, DAILY_STANDARDS.fat).text }}
              </div>
            </div>
          </div>
        </div>
        
        <div v-else class="no-data">아직 기록된 식단이 없습니다</div>
      </div>

      <!-- 로그아웃 버튼 -->
      <button @click="handleLogout" class="logout-btn">로그아웃</button>
    </div>

    <!-- 수정 모달 -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <h3>⚙️ 건강 프로필 수정</h3>
        <form @submit.prevent="saveHealthProfile">
          <div class="form-row">
            <div class="form-group">
              <label>키 (cm)</label>
              <input type="number" v-model="health.height" step="0.1" required />
            </div>
            <div class="form-group">
              <label>현재 몸무게 (kg)</label>
              <input type="number" v-model="health.weight" step="0.1" required />
            </div>
          </div>

          <div class="form-group">
            <label>목표 몸무게 (kg)</label>
            <input type="number" v-model="health.targetWeight" step="0.1" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>나이 (세)</label>
              <input type="number" v-model="health.age" required />
            </div>
            <div class="form-group">
              <label>성별</label>
              <select v-model="health.gender" required>
                <option value="F">여성</option>
                <option value="M">남성</option>
              </select>
            </div>
          </div>

          <div class="modal-buttons">
            <button type="button" @click="closeEditModal" class="btn-cancel">취소</button>
            <button type="submit" :disabled="saving" class="btn-save">
              {{ saving ? '저장 중...' : '저장' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 🆕 식사 기록 모달 -->
    <div v-if="showMealModal" class="modal-overlay" @click="closeMealModal">
      <div class="modal-content meal-modal" @click.stop>
        <h3>🍽️ 재고에서 식사 기록</h3>
        
        <div class="meal-form">
          <div class="form-group">
            <label>식사 이름</label>
            <input 
              type="text" 
              v-model="mealName" 
              placeholder="예: 아침 식사, 점심 도시락" 
              required 
            />
          </div>

          <div class="inventory-selection">
            <h4>재고 선택</h4>
            <div v-if="inventoryList.length === 0" class="no-data">
              재고가 없습니다
            </div>
            <div v-else class="inventory-list">
              <div 
                v-for="item in inventoryList" 
                :key="item.inventory_id"
                class="inventory-item"
                :class="{ selected: isSelected(item.inventory_id) }"
                @click="toggleItem(item)"
              >
                <div class="item-info">
                  <span class="item-name">{{ item.item_name }}</span>
                  <span class="item-stock">재고: {{ item.quantity }}개</span>
                </div>
                <div v-if="isSelected(item.inventory_id)" class="item-quantity" @click.stop>
                  <label>사용량:</label>
                  <input 
                    type="number" 
                    :value="selectedItems.find(i => i.inventory_id === item.inventory_id)?.quantity"
                    @input="updateQuantity(item.inventory_id, $event.target.value)"
                    :max="item.quantity"
                    min="0.1"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 선택된 아이템 요약 -->
          <div v-if="selectedItems.length > 0" class="selected-summary">
            <h4>선택한 재료 ({{ selectedItems.length }}개)</h4>
            <div class="summary-items">
              <div v-for="item in selectedItems" :key="item.inventory_id" class="summary-item">
                <span>{{ item.item_name }}</span>
                <span>{{ item.quantity }}개</span>
              </div>
            </div>
            
            <div class="total-nutrients">
              <h4>총 영양소 <span class="estimate-badge">추정치</span></h4>
              
              <!-- 영양 정보가 없을 때 안내 -->
              <div v-if="totalNutrients.calories === 0 && totalNutrients.carbs === 0" class="nutrition-notice">
                <span class="notice-icon">ℹ️</span>
                <p>영양 정보가 아직 등록되지 않은 재료입니다.<br>식사는 정상적으로 기록됩니다.</p>
              </div>
              
              <div class="nutrient-grid">
                <div class="nutrient">
                  <span class="label">칼로리</span>
                  <span class="value">{{ totalNutrients.calories.toFixed(1) }} kcal</span>
                </div>
                <div class="nutrient">
                  <span class="label">탄수화물</span>
                  <span class="value">{{ totalNutrients.carbs.toFixed(1) }} g</span>
                </div>
                <div class="nutrient">
                  <span class="label">단백질</span>
                  <span class="value">{{ totalNutrients.protein.toFixed(1) }} g</span>
                </div>
                <div class="nutrient">
                  <span class="label">지방</span>
                  <span class="value">{{ totalNutrients.fat.toFixed(1) }} g</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-buttons">
            <button type="button" @click="closeMealModal" class="btn-cancel">취소</button>
            <button 
              type="button" 
              @click="saveMeal" 
              :disabled="savingMeal || selectedItems.length === 0"
              class="btn-save"
            >
              {{ savingMeal ? '저장 중...' : '기록하기' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.health-container {
  height: 100%;
  overflow-y: auto;
  background: #f8f9fa;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #FF6600;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 초기 설정 화면 */
.setup-required {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
}

.setup-card {
  background: white;
  border-radius: 16px;
  padding: 32px 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.setup-card h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #333;
  text-align: center;
}

.setup-card p {
  margin: 0 0 24px 0;
  text-align: center;
  color: #666;
  font-size: 14px;
}

/* 대시보드 */
.dashboard {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.btn-settings {
  width: 40px;
  height: 40px;
  border: none;
  background: white;
  border-radius: 50%;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.btn-settings:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 카드 공통 */
.card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 🆕 카드 헤더 (식사 기록 버튼 포함) */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.estimate-badge.small {
  font-size: 10px;
  padding: 2px 6px;
}

.btn-add-meal {
  padding: 8px 16px;
  background: #FF6600;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-meal:hover {
  background: #e55a00;
  transform: translateY(-1px);
}

/* 1. 오늘의 영양 섭취 */
.nutrition-circle {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.circle-main {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 12px solid #4CAF50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.calories-value {
  font-size: 32px;
  font-weight: 700;
  color: #333;
}

.calories-label {
  font-size: 11px;
  color: #666;
  text-align: center;
}

.nutrition-bars {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.nutrition-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nutrition-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nutrient-name {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.nutrient-value {
  font-size: 14px;
  font-weight: 700;
  color: #333;
}

.progress-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s;
  border-radius: 4px;
}

.progress-fill.carbs {
  background: linear-gradient(90deg, #4CAF50, #8BC34A);
}

.progress-fill.protein {
  background: linear-gradient(90deg, #2196F3, #03A9F4);
}

.progress-fill.fat {
  background: linear-gradient(90deg, #FF9800, #FFC107);
}

.percentage {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #666;
}

/* 2. 몸무게 기록 */
.weight-input {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.weight-input input {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
}

.weight-input button {
  padding: 10px 20px;
  background: #FF6600;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.weight-input button:hover:not(:disabled) {
  background: #e55a00;
}

.weight-input button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.weight-chart {
  margin-top: 16px;
}

.chart-svg {
  width: 100%;
  height: 200px;
}

.chart-legend {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 12px;
  font-size: 13px;
  color: #666;
}

.legend-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 6px;
}

.legend-dot.current {
  background: #1976d2;
}

.legend-dot.target {
  background: #FFA500;
}

/* 3. 최근 5일 식단 */
.meals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}

.meal-day {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  text-align: center;
}

.meal-date {
  font-weight: 700;
  font-size: 14px;
  color: #333;
  margin-bottom: 8px;
}

.meal-nutrients {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nutrient-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.nutrient-badge.low {
  background: #fee2e2;
  color: #991b1b;
}

.nutrient-badge.good {
  background: #d1fae5;
  color: #065f46;
}

.nutrient-badge.high {
  background: #fef3c7;
  color: #92400e;
}

.no-data {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

/* 폼 스타일 */
.health-form, .meal-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.form-group input,
.form-group select {
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #FF6600;
  box-shadow: 0 0 0 3px rgba(255, 102, 0, 0.1);
}

.btn-save {
  width: 100%;
  padding: 14px;
  background: #FF6600;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.btn-save:hover:not(:disabled) {
  background: #e55a00;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 102, 0, 0.3);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 로그아웃 버튼 */
.logout-btn {
  width: 100%;
  padding: 14px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #dc2626;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

/* 모달 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
}

.modal-content.meal-modal {
  max-width: 600px;
}

.modal-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-cancel {
  flex: 1;
  padding: 12px;
  background: white;
  color: #757575;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel:hover {
  background: #f5f5f5;
}

/* 🆕 식사 기록 모달 전용 스타일 */
.inventory-selection {
  margin-top: 20px;
}

.inventory-selection h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.inventory-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
}

.inventory-item {
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.inventory-item:hover {
  border-color: #FF6600;
  background: #fff5f0;
}

.inventory-item.selected {
  border-color: #FF6600;
  background: #fff5f0;
}

.item-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-name {
  font-weight: 600;
  color: #333;
}

.item-stock {
  font-size: 12px;
  color: #666;
}

.item-quantity {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-quantity label {
  font-size: 13px;
  color: #666;
}

.item-quantity input {
  flex: 1;
  padding: 6px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

/* 선택된 아이템 요약 */
.selected-summary {
  margin-top: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.selected-summary h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.summary-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #666;
}

.total-nutrients {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 2px solid #e0e0e0;
}

.total-nutrients h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.estimate-badge {
  font-size: 11px;
  font-weight: 500;
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 8px;
  border-radius: 10px;
}

.nutrient-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.nutrient {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nutrient .label {
  font-size: 12px;
  color: #666;
}

.nutrient .value {
  font-size: 15px;
  font-weight: 700;
  color: #FF6600;
}

/* 영양 정보 안내 */
.nutrition-notice {
  background: #fff9e6;
  border: 1px solid #ffd54f;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.notice-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.nutrition-notice p {
  margin: 0;
  font-size: 13px;
  color: #856404;
  line-height: 1.5;
}

/* 스크롤바 */
.health-container::-webkit-scrollbar,
.inventory-list::-webkit-scrollbar,
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.health-container::-webkit-scrollbar-track,
.inventory-list::-webkit-scrollbar-track,
.modal-content::-webkit-scrollbar-track {
  background: #e5e5e5;
}

.health-container::-webkit-scrollbar-thumb,
.inventory-list::-webkit-scrollbar-thumb,
.modal-content::-webkit-scrollbar-thumb {
  background: #FF6600;
  border-radius: 4px;
}

@media (max-width: 480px) {
  .form-row {
    flex-direction: column;
  }
  
  .meals-grid {
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  }
  
  .nutrition-bars {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .nutrient-grid {
    grid-template-columns: 1fr;
  }
}
</style>