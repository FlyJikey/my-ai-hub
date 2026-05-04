// Тестовый скрипт для проверки поиска по каталогу
// Запустите в консоли браузера (F12) на странице чата

async function testCatalogSearch() {
    console.log("=== ТЕСТ ПОИСКА ПО КАТАЛОГУ ===");
    
    // Получаем выбранную модель из контекста
    const embeddingModel = localStorage.getItem('selectedEmbeddingModel');
    console.log("1. Выбранная модель из localStorage:", embeddingModel);
    
    // Тестовый запрос
    const testQuery = "товары";
    console.log("2. Тестовый запрос:", testQuery);
    
    try {
        const response = await fetch("/api/catalog/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                query: testQuery, 
                limit: 20,
                embeddingModel: "text-embedding-3-small",
                embeddingProvider: "polza"
            })
        });
        
        console.log("3. Статус ответа:", response.status);
        
        const data = await response.json();
        console.log("4. Результат поиска:", data);
        console.log("5. Найдено товаров:", data.count);
        
        if (data.results && data.results.length > 0) {
            console.log("6. Первые 3 товара:");
            data.results.slice(0, 3).forEach((p, i) => {
                console.log(`   ${i+1}. [${p.sku}] ${p.name} - ${p.price}₽`);
            });
        }
        
        return data;
    } catch (error) {
        console.error("ОШИБКА:", error);
        return null;
    }
}

// Запустить тест
testCatalogSearch();
