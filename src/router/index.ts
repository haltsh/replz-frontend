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
    redirect: to => {
      // 로그인 상태 확인
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
      return isLoggedIn ? '/inventory' : '/login'
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
router.beforeEach((
  to: RouteLocationNormalized, 
  from: RouteLocationNormalized, 
  next: NavigationGuardNext
) => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true'
  const requiresAuth = to.meta.requiresAuth

  if (requiresAuth && !isLoggedIn) {
    next('/login')
  } 
  else if (to.path === '/login' && isLoggedIn) {
    next('/inventory')
  } 
  else {
    next()
  }
})

export default router