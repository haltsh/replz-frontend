<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="notfound-container">
    <div class="notfound-content">
      <div class="error-icon">🔍</div>
      <h1 class="error-code">404</h1>
      <h2 class="error-title">페이지를 찾을 수 없습니다</h2>
      <p class="error-message">
        요청하신 페이지가 존재하지 않거나<br>
        이동되었을 수 있습니다.
      </p>
      <button class="btn-home" @click="router.push('/inventory')">
        홈으로 돌아가기
      </button>
    </div>
  </div>
</template>

<style scoped>
.notfound-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fa;
  padding: 20px;
}

.notfound-content {
  text-align: center;
  max-width: 400px;
}

.error-icon {
  font-size: 80px;
  margin-bottom: 20px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
}

.error-code {
  font-size: 72px;
  font-weight: 800;
  color: #FF6600;
  margin: 0 0 16px 0;
  text-shadow: 2px 2px 4px rgba(255, 102, 0, 0.2);
}

.error-title {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin: 0 0 12px 0;
}

.error-message {
  font-size: 15px;
  color: #666;
  line-height: 1.6;
  margin: 0 0 32px 0;
}

.btn-home {
  padding: 14px 32px;
  background: #FF6600;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-home:hover {
  background: #e55a00;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 102, 0, 0.3);
}
</style>