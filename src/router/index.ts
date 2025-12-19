import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // ==========================================
  // 인증 페이지 (로그인 안 해도 접근 가능)
  // ==========================================
  { 
    path: '/login', 
    name: 'Login',
    component: () => import('@/pages/Login.vue'),
    meta: { requiresAuth: false }
  },
  { 
    path: '/register', 
    name: 'Register',
    component: () => import('@/pages/Register.vue'),
    meta: { requiresAuth: false }
  },
  { 
    path: '/forgot-password', 
    name: 'ForgotPassword',
    component: () => import('@/pages/ForgetPassword.vue'),
    meta: { requiresAuth: false }
  },

  // ==========================================
  // 메인 페이지 (로그인 필요)
  // ==========================================
  { 
    path: '/inventory', 
    name: 'Inventory',
    component: () => import('@/pages/Inventory.vue'),
    meta: { requiresAuth: true }
  },
  { 
    path: '/scan', 
    name: 'Scan',
    component: () => import('@/pages/Scan.vue'),
    meta: { requiresAuth: true }
  },
  { 
    path: '/recipes', 
    name: 'Recipes',
    component: () => import('@/pages/Recipes.vue'),
    meta: { requiresAuth: true }
  },
  { 
    path: '/settings', 
    name: 'Settings',
    component: () => import('@/pages/Settings.vue'),
    meta: { requiresAuth: true }
  },

  // ==========================================
  // 기타
  // ==========================================
  { 
    path: '/', 
    redirect: () => {
      // 로그인 상태 확인 (isLoggedIn과 user_id 둘 다 체크)
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
      const userId = localStorage.getItem('user_id')
      return (isLoggedIn && userId) ? '/settings' : '/login'
    }
  },
  { 
    path: '/:pathMatch(.*)*', 
    name: 'NotFound',
    component: () => import('@/pages/NotFound.vue') 
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() { 
    return { top: 0 } 
  },
})

// ==========================================
// 네비게이션 가드 (인증 체크)
// ==========================================
router.beforeEach((to: any, from: any, next: any) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  const userId = localStorage.getItem('user_id')
  const requiresAuth = to.meta.requiresAuth

  // 🔒 인증 상태: isLoggedIn과 user_id 둘 다 있어야 함
  const isAuthenticated = isLoggedIn && userId

  // 로그인이 필요한 페이지인데 인증 안 됐으면
  if (requiresAuth && !isAuthenticated) {
    // 인증 정보 초기화 (일관성 유지)
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('user_id')
    next('/login')
  } 
  // 로그인 페이지인데 이미 인증 됐으면
  else if (to.path === '/login' && isAuthenticated) {
    next('/settings')
  } 
  // 회원가입/비밀번호 찾기 페이지인데 이미 인증 됐으면
  else if ((to.path === '/register' || to.path === '/forgot-password') && isAuthenticated) {
    next('/settings')
  }
  // 그 외에는 정상 진행
  else {
    next()
  }
})

export default router