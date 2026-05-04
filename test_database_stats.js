// Скрипт для проверки статистики базы данных
// Запустите в консоли браузера

async function checkDatabaseStats() {
    console.log("=== ПРОВЕРКА СТАТИСТИКИ БАЗЫ ===");
    
    try {
        const response = await fetch("/api/catalog/stats");
        const stats = await response.json();
        
        console.log("📊 Статистика базы данных:");
        console.log("   Всего товаров:", stats.total);
        console.log("   Векторизовано:", stats.vectorized);
        console.log("   Категорий:", stats.categories);
        console.log("   Последнее обновление:", stats.lastUpdated);
        console.log("   Есть данные:", stats.hasData);
        
        if (stats.total !== stats.vectorized) {
            console.warn("⚠️ НЕ ВСЕ ТОВАРЫ ВЕКТОРИЗОВАНЫ!");
            console.warn(`   Не векторизовано: ${stats.total - stats.vectorized} товаров`);
        } else {
            console.log("✅ Все товары векторизованы");
        }
        
        return stats;
    } catch (error) {
        console.error("❌ ОШИБКА при получении статистики:", error);
        return null;
    }
}

checkDatabaseStats();
