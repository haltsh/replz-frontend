<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

function navigateTo(page) {
  router.push(`/${page}`)
}
</script>

<template>
  <div class="app-wrapper">
    <!-- 상단바 -->
    <header class="top-bar">
      <div class="logo">
        <img src="/logo.png" alt="Logo" class="logo-img" />
      </div>
      <button class="scan-btn" @click="navigateTo('scan')">
        📸 Scan
      </button>
    </header>

    <!-- 메인 콘텐츠 영역 -->
    <main class="main-wrapper">
      <router-view />
    </main>

    <!-- 하단바 -->
    <nav class="bottom-bar">
      <button 
        class="nav-btn" 
        :class="{ active: route.path === '/settings' }"
        @click="navigateTo('settings')"
      >
        <span class="nav-icon">👤</span>
        <span class="nav-label">마이페이지</span>
      </button>
      <button 
        class="nav-btn" 
        :class="{ active: route.path === '/inventory' }"
        @click="navigateTo('inventory')"
      >
        <span class="nav-icon">📦</span>
        <span class="nav-label">재고</span>
      </button>
      <button 
        class="nav-btn" 
        :class="{ active: route.path === '/recipes' }"
        @click="navigateTo('recipes')"
      >
        <span class="nav-icon">🍳</span>
        <span class="nav-label">레시피</span>
      </button>
    </nav>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

#app {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #e0e0e0;
}

.app-wrapper {
  width: 100%;
  height: 100%;
  /* 👇 PC에서 보기 좋은 크기 */
  max-width: 480px;
  max-height: 932px;
  /* aspect-ratio 제거 */
  
  margin: 0 auto;
  display: grid;
  grid-template-rows: 10% 80% 10%;
  background: #f8f9fa;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  position: relative;
}

/* 모바일에서는 전체 화면 */
@media (max-width: 768px) {
  .app-wrapper {
    max-width: 100vw;
    max-height: 100vh;
  }
}

/* 큰 화면에서 더 크게 */
@media (min-width: 1440px) {
  .app-wrapper {
    max-width: 540px;
    max-height: 1080px;
  }
}

/* 상단바 */
.top-bar {
  background: #FF6600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logo {
  height: 60%;
  display: flex;
  align-items: center;
}

.logo-img {
  height: 100%;
  width: auto;
}

.scan-btn {
  background: white;
  color: #FF6600;
  border: none;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.scan-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* 메인 콘텐츠 */
.main-wrapper {
  background: #f8f9fa;
  overflow: hidden;
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 하단바 */
.bottom-bar {
  background: white;
  border-top: 2px solid #FF6600;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 20px;
}

.nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px 16px;
  transition: all 0.2s;
  border-radius: 8px;
}

.nav-btn:hover {
  background: #fff5f0;
}

.nav-btn.active {
  background: #fff5f0;
}

.nav-btn.active .nav-icon {
  transform: scale(1.2);
}

.nav-btn.active .nav-label {
  color: #FF6600;
  font-weight: 700;
}

.nav-icon {
  font-size: 24px;
  transition: transform 0.2s;
}

.nav-label {
  font-size: 11px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
}
</style>