<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE } from '@/config/api'

const router = useRouter()

const loginId = ref('')
const username = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const loading = ref(false)
const error = ref('')
const step = ref(1) // 1=본인확인, 2=비밀번호변경

async function verifyUser() {
  if (!loginId.value || !username.value) {
    error.value = '아이디와 닉네임을 입력하세요.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE}/auth/verify-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login_id: loginId.value,
        username: username.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '일치하는 사용자 정보가 없습니다.')
    }

    step.value = 2
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function resetPassword() {
  if (!newPassword.value || !confirmPassword.value) {
    error.value = '모든 항목을 입력하세요.'
    return
  }

  if (newPassword.value.length < 4) {
    error.value = '비밀번호는 4자 이상이어야 합니다.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    error.value = '비밀번호가 일치하지 않습니다.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${API_BASE}/auth/reset-password-simple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login_id: loginId.value,
        username: username.value,
        newPassword: newPassword.value
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '비밀번호 변경 실패')
    }

    alert('비밀번호가 변경되었습니다!')
    router.push('/login')
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function goBack() {
  if (step.value === 2) {
    step.value = 1
    error.value = ''
  } else {
    router.push('/login')
  }
}
</script>

<template>
  <div class="forgot-page">
    <div class="forgot-container">
      <div class="forgot-card">
        <div class="logo">
          <img src="/logo.png" alt="Replz Logo" class="logo-image" />
          <h2>🔑 비밀번호 찾기</h2>
        </div>

        <!-- 1단계: 본인 확인 -->
        <form v-if="step === 1" @submit.prevent="verifyUser" class="form">
          <p class="description">
            가입 시 등록한 아이디와 닉네임을 입력하세요.
          </p>

          <div class="form-group">
            <label>아이디</label>
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

          <div v-if="error" class="error">{{ error }}</div>

          <button type="submit" class="btn-primary" :disabled="loading">
            {{ loading ? '확인 중...' : '다음' }}
          </button>

          <button type="button" class="btn-text" @click="router.push('/login')">
            로그인으로 돌아가기
          </button>
        </form>

        <!-- 2단계: 새 비밀번호 설정 -->
        <form v-if="step === 2" @submit.prevent="resetPassword" class="form">
          <div class="info-box">
            <p>✅ 본인 확인 완료</p>
            <p><strong>{{ loginId }}</strong> ({{ username }})</p>
          </div>

          <div class="form-group">
            <label>새 비밀번호 (4자 이상)</label>
            <input
              type="password"
              v-model="newPassword"
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
            {{ loading ? '변경 중...' : '비밀번호 변경' }}
          </button>

          <button type="button" class="btn-text" @click="goBack">
            이전으로
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.forgot-page::-webkit-scrollbar {
  display: none;
}

.forgot-container {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
}

.forgot-card {
  background: white;
  border-radius: 20px;
  padding: 20px 28px 24px 28px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.logo {
  text-align: center;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.logo-image {
  height: 70px;
  width: auto;
  object-fit: contain;
}

.logo h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
  font-weight: 600;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.description {
  text-align: center;
  color: #666;
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 6px 0;
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
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.info-box {
  background: #e8f5e9;
  padding: 14px;
  border-radius: 8px;
  text-align: center;
}

.info-box p {
  margin: 3px 0;
  font-size: 13px;
  color: #555;
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
  .forgot-card {
    padding: 20px 24px;
  }
  
  .logo-image {
    height: 80px;
  }
}
</style>