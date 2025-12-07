<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/api'

const router = useRouter()

const loginId = ref('')
const password = ref('')
const confirmPassword = ref('')
const username = ref('')

const loading = ref(false)
const error = ref('')

async function handleRegister() {
  // 유효성 검사
  if (!loginId.value || !password.value || !username.value) {
    error.value = '모든 항목을 입력하세요.'
    return
  }

  if (loginId.value.length < 4) {
    error.value = '아이디는 4자 이상이어야 합니다.'
    return
  }

  if (password.value.length < 4) {
    error.value = '비밀번호는 4자 이상이어야 합니다.'
    return
  }

  if (password.value !== confirmPassword.value) {
    error.value = '비밀번호가 일치하지 않습니다.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login_id: loginId.value,
        password: password.value,
        username: username.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '회원가입 실패')
    }

    alert('회원가입이 완료되었습니다!')
    router.push('/login')
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-page">
    <div class="register-container">
      <div class="register-card">
        <div class="logo">
          <h1>🧊 Smart Replzerator</h1>
          <p>회원가입</p>
        </div>

        <form @submit.prevent="handleRegister" class="form">
          <div class="form-group">
            <label>아이디 (4자 이상)</label>
            <input
              type="text"
              v-model="loginId"
              placeholder="아이디 입력"
              :disabled="loading"
              required
            />
          </div>

          <div class="form-group">
            <label>닉네임</label>
            <input
              type="text"
              v-model="username"
              placeholder="닉네임 입력"
              :disabled="loading"
              required
            />
          </div>

          <div class="form-group">
            <label>비밀번호 (4자 이상)</label>
            <input
              type="password"
              v-model="password"
              placeholder="••••"
              :disabled="loading"
              required
            />
          </div>

          <div class="form-group">
            <label>비밀번호 확인</label>
            <input
              type="password"
              v-model="confirmPassword"
              placeholder="••••"
              :disabled="loading"
              required
            />
          </div>

          <div v-if="error" class="error">{{ error }}</div>

          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? '처리 중...' : '회원가입' }}
          </button>

          <button type="button" class="btn-text" @click="router.push('/login')">
            이미 계정이 있으신가요?
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 스크롤 가능하지만 스크롤바 숨김 */
.register-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  /* 스크롤바 숨기기 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.register-page::-webkit-scrollbar {
  display: none;
}

.register-container {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
}

.register-card {
  background: white;
  border-radius: 20px;
  padding: 24px 28px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.logo {
  text-align: center;
  margin-bottom: 20px;
}

.logo h1 {
  margin: 0 0 4px 0;
  font-size: 20px;
  color: #333;
}

.logo p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #555;
}

.form-group input {
  padding: 11px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.error {
  padding: 10px;
  background: #ffebee;
  color: #c62828;
  border-radius: 8px;
  font-size: 13px;
  text-align: center;
}

.btn-primary,
.btn-text {
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-text {
  background: none;
  color: #999;
  font-size: 13px;
  text-decoration: underline;
}

.btn-text:hover {
  color: #667eea;
}

@media (max-width: 480px) {
  .register-card {
    padding: 20px 24px;
  }
}
</style>