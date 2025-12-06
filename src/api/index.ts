const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// ========================================
// 🔐 현재 로그인한 사용자 ID 가져오기
// ========================================
export function getCurrentUserId(): number {
  const userId = localStorage.getItem('user_id');
  if (!userId) {
    console.warn('⚠️ 로그인 정보가 없습니다. 기본값 1 사용');
    return 1;
  }
  return parseInt(userId);
}

// ========================================
// 인증 관련 API
// ========================================

// 회원가입 (이메일 인증 제거)
export async function register(payload: {
  login_id: string;
  password: string;
  username: string;
}) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '회원가입 실패');
  }

  return res.json();
}

export async function login(payload: {
  login_id: string;
  password: string;
}) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '로그인 실패');
  }

  return res.json();
}

// ========================================
// 영수증 관련 API
// ========================================

export async function uploadReceiptImage(file: File) {
  const userId = getCurrentUserId();
  const formData = new FormData();
  formData.append("receipt", file);
  formData.append("user_id", String(userId));

  const res = await fetch(`${API_BASE}/receipts/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "업로드 실패");
  }

  return res.json();
}

export async function getOcrItems(receiptId: number) {
  const res = await fetch(`${API_BASE}/receipts/${receiptId}/items`);
  if (!res.ok) throw new Error("OCR 결과 조회 실패");
  return res.json();
}

export async function upsertItemsBatch(payload: {
  items: Array<{
    item_name: string;
    category: string;
    basic_expiration_days: number | null;
  }>;
}) {
  const res = await fetch(`${API_BASE}/receipts/items/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "DB 저장 실패");
  }

  return res.json();
}

export async function addToInventory(payload: {
  items: Array<{
    item_name: string;
    quantity: number;
    expiration_date: string | null;
  }>;
}) {
  const userId = getCurrentUserId();
  const res = await fetch(`${API_BASE}/receipts/add-to-inventory`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      items: payload.items
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "재고 추가 실패");
  }

  return res.json();
}

// ========================================
// 재고 관련 API
// ========================================

export async function getInventory() {
  const userId = getCurrentUserId();
  const res = await fetch(`${API_BASE}/inventories?user_id=${userId}`);
  if (!res.ok) throw new Error("재고 조회 실패");
  return res.json();
}

export async function listInventory() {
  return getInventory();
}

export async function deleteInventory(inventoryId: number) {
  const userId = getCurrentUserId();
  const res = await fetch(`${API_BASE}/inventories/${inventoryId}?user_id=${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("재고 삭제 실패");
  return res.json();
}

// ========================================
// 품목 관련 API
// ========================================

export async function getItems() {
  const res = await fetch(`${API_BASE}/items`);
  if (!res.ok) throw new Error("품목 조회 실패");
  return res.json();
}

// ========================================
// 레시피 관련 API
// ========================================

export async function searchRecipesFromCrawler(
  ingredients: string[], 
  limit: number = 5
) {
  const userId = getCurrentUserId();
  const res = await fetch(`${API_BASE}/recipes/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      ingredients,
      userId,
      limit 
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `레시피 검색 오류: ${res.status}`);
  }

  return res.json();
}

export async function fetchRecipeDetail(url: string) {
  const res = await fetch(`${API_BASE}/recipes/fetch-detail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '레시피 상세 정보 조회 실패');
  }

  return res.json();
}

export async function getRecipes() {
  const res = await fetch(`${API_BASE}/recipes`);
  if (!res.ok) throw new Error('레시피 조회 실패');
  return res.json();
}

export async function getRecipeDetail(recipeId: number) {
  const res = await fetch(`${API_BASE}/recipes/${recipeId}`);
  if (!res.ok) throw new Error('레시피 상세 조회 실패');
  return res.json();
}

export async function createRecipe(data: {
  menu: string;
  description?: string;
  image_url?: string;
}) {
  const res = await fetch(`${API_BASE}/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '레시피 추가 실패');
  }
  
  return res.json();
}

export async function addRecipeItem(data: {
  recipe_id: number;
  item_id?: number;
  ingredient_name: string;
  quantity?: number;
}) {
  const res = await fetch(`${API_BASE}/recipe-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '레시피 재료 추가 실패');
  }
  
  return res.json();
}

export async function deleteRecipe(recipeId: number) {
  const res = await fetch(`${API_BASE}/recipes/${recipeId}`, {
    method: 'DELETE'
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '레시피 삭제 실패');
  }
  
  return res.json();
}

export async function getRecommendedRecipesFromDB() {
  const userId = getCurrentUserId();
  const res = await fetch(`${API_BASE}/recipes/recommend/${userId}`);
  if (!res.ok) throw new Error('추천 레시피 조회 실패');
  return res.json();
}

export async function getRecipeHealthInfo(recipeUrl: string) {
  const res = await fetch(`${API_BASE}/recipes/health-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipe_url: recipeUrl })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '건강 정보 조회 실패');
  }
  
  return res.json();
}

// ========================================
// 헬스 프로필 관련 API
// ========================================

export async function saveHealthProfile(payload: {
  height_cm: number | null;
  weight_kg: number | null;
  age_years: number | null;
  sex: string | null;
  calorie_goal_kcal_per_day: number | null;
}) {
  const userId = getCurrentUserId();
  const res = await fetch(`${API_BASE}/health-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      ...payload
    }),
  });
  if (!res.ok) throw new Error("헬스 프로필 저장 실패");
  return res.json();
}

export async function getHealthProfile() {
  const userId = getCurrentUserId();
  const res = await fetch(`${API_BASE}/health-profile?user_id=${userId}`);
  if (!res.ok) throw new Error("헬스 프로필 조회 실패");
  return res.json();
}

// ========================================
// ✅ API 사용법 안내
// ========================================
/*
📝 변경사항 요약:
1. getCurrentUserId() 함수 추가 - localStorage에서 user_id 자동 가져오기
2. 모든 API 함수에서 userId 파라미터 제거 - 자동으로 현재 사용자 사용
3. 로그인하지 않은 경우 기본값 1 사용 (개발 편의)

💡 사용법:
- 로그인 후 localStorage에 user_id가 저장되면 자동으로 해당 유저의 데이터 조회
- Vue 컴포넌트에서는 userId를 신경 쓸 필요 없음!
- 예: uploadReceiptImage(file) ← userId 파라미터 불필요

🔧 로그인 처리:
Login.vue에서 로그인 성공 시:
  localStorage.setItem('user_id', data.user_id)
  localStorage.setItem('isLoggedIn', 'true')

📌 주의사항:
- 로그아웃 시 localStorage.clear() 호출 필요
- getCurrentUserId()를 직접 export하므로 필요시 다른 곳에서도 사용 가능
*/