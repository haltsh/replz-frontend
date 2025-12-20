<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/api'

const router = useRouter()

const loginId = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!loginId.value || !password.value) {
    error.value = '아이디와 비밀번호를 입력해주세요.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login_id: loginId.value,
        password: password.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '로그인에 실패했습니다.')
    }

    // 로컬 스토리지에 저장
    localStorage.setItem('user_id', data.user_id)
    localStorage.setItem('login_id', data.login_id)
    localStorage.setItem('username', data.username)
    localStorage.setItem('isLoggedIn', 'true')

    router.push('/inventory')
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="logo">
          <img src="/logo.png" alt="Replz Logo" class="logo-image" />
          <p>스마트 냉장고 관리 시스템</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="loginId">아이디</label>
            <input
              id="loginId"
              type="text"
              v-model="loginId"
              placeholder="아이디"
              :disabled="loading"
              required
            />
          </div>

          <div class="form-group">
            <label for="password">비밀번호</label>
            <input
              id="password"
              type="password"
              v-model="password"
              placeholder="비밀번호"
              :disabled="loading"
              required
            />
          </div>

          <div v-if="error" class="error-message">
            {{ error }}
          </div>

          <button 
            type="submit" 
            class="submit-btn"
            :disabled="loading"
          >
            {{ loading ? '로그인 중...' : '로그인' }}
          </button>
        </form>

        <div class="footer-links">
          <a @click="router.push('/forgot-password')" class="link">
            비밀번호를 잊으셨나요?
          </a>
        </div>

        <div class="register-section">
          <div class="divider">
            <span>OR</span>
          </div>
          <button 
            type="button"
            class="register-btn"
            @click="router.push('/register')"
          >
            🎉 회원가입하기
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.login-page::-webkit-scrollbar {
  display: none;
}

.login-container {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
}

.login-card {
  background: white;
  border-radius: 20px;
  padding: 20px 28px 24px 28px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.logo {
  text-align: center;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.logo-image {
  height: 80px;
  width: auto;
  object-fit: contain;
}

.logo h1 {
  margin: 0;
  font-size: 28px;
  color: #333;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.logo h1 {
  margin: 0;
  font-size: 28px;
  color: #333;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.logo p {
  margin: 0;
  color: #666;
  font-size: 12px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  padding: 11px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.error-message {
  padding: 12px;
  background: #ffebee;
  color: #c62828;
  border-radius: 8px;
  font-size: 13px;
  text-align: center;
}

.submit-btn {
  padding: 13px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.footer-links {
  text-align: center;
  margin-bottom: 14px;
}

.footer-links .link {
  color: #999;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
}

.footer-links .link:hover {
  color: #667eea;
  text-decoration: underline;
}

.register-section {
  margin-top: 14px;
}

.divider {
  position: relative;
  text-align: center;
  margin: 14px 0;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 44%;
  height: 1px;
  background: #e0e0e0;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.divider span {
  background: white;
  padding: 0 12px;
  color: #999;
  font-size: 12px;
  font-weight: 500;
}

.register-btn {
  width: 100%;
  padding: 13px;
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.register-btn:hover {
  background: #667eea;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

@media (max-width: 480px) {
  .login-card {
    padding: 32px 24px;
  }

  .logo-image {
    height: 90px;
  }
}
</style>