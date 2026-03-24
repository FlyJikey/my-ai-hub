import * as xlsx from 'xlsx';
import Papa from 'papaparse';

export function parseCatalog(buffer, type) {
    let rawData = [];

    // 1. Извлечь сырые данные в зависимости от типа
    if (type === 'json') {
        try {
            const jsonString = buffer.toString('utf-8');
            rawData = JSON.parse(jsonString);
            if (!Array.isArray(rawData)) {
                rawData = [rawData]; // Если это одиночный объект
            }
        } catch (e) {
            throw new Error('Ошибка парсинга JSON: ' + e.message);
        }
    } else if (type === 'csv') {
        const csvString = buffer.toString('utf-8');
        const parsed = Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true,
        });
        if (parsed.errors && parsed.errors.length > 0) {
            console.error('Предупреждения парсинга CSV:', parsed.errors);
        }
        rawData = parsed.data;
    } else if (type === 'xlsx' || type === 'xls') {
        try {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            rawData = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
        } catch (e) {
            throw new Error('Ошибка парсинга Excel: ' + e.message);
        }
    } else {
        throw new Error(`Неподдерживаемый тип файла: ${type}`);
    }

    if (!rawData || rawData.length === 0) {
        throw new Error('Файл не содержит данных');
    }

    // 2. Нормализация данных
    const skuKeys = ["Артикул", "SKU", "Article", "арт", "Арт", "код", "ID"];
    const nameKeys = ["Название", "Name", "Наименование", "Товар", "title"];
    const categoryKeys = ["Категория", "Category", "Раздел", "Тип"];
    const descriptionKeys = ["Описание", "Description", "Описание товара"];
    const priceKeys = ["Цена", "Price", "Стоимость", "Цена, руб"];
    const brandKeys = ["Бренд", "Brand", "Марка", "Производитель", "Manufacturer", "Vendor"];

    const findKey = (row, possibleKeys) => {
        const rowKeys = Object.keys(row);
        for (const possibleKey of possibleKeys) {
            const found = rowKeys.find(k => k.trim().toLowerCase() === possibleKey.toLowerCase());
            if (found) return found;
        }
        return null; // не найдено
    };

    const normalizeRow = (row) => {
        const originalKeys = Object.keys(row);
        
        let skuKey = findKey(row, skuKeys);
        let nameKey = findKey(row, nameKeys);
        let catKey = findKey(row, categoryKeys);
        let descKey = findKey(row, descriptionKeys);
        let priceKey = findKey(row, priceKeys);
        let brandKey = findKey(row, brandKeys);

        const sku = skuKey ? String(row[skuKey] || '') : '';
        const name = nameKey ? String(row[nameKey] || '') : '';
        const category = catKey ? String(row[catKey] || '') : '';
        const description = descKey ? String(row[descKey] || '') : '';
        const brand = brandKey ? String(row[brandKey] || '') : '';
        const priceStr = priceKey ? String(row[priceKey] || '').replace(/[^\d.,]/g, '').replace(',', '.') : '';
        const price = parseFloat(priceStr) || 0;

        const attributes = {};
        const reservedKeys = [skuKey, nameKey, catKey, descKey, priceKey].filter(Boolean);

        for (const key of originalKeys) {
            if (!reservedKeys.includes(key)) {
                if (row[key] !== null && row[key] !== undefined && row[key] !== '') {
                    attributes[key.trim()] = row[key];
                }
            }
        }

        // Формируем raw_text для эмбеддинга
        const textParts = [];
        if (sku) textParts.push(`Артикул: ${sku}`);
        if (name) textParts.push(`Название: ${name}`);
        if (brand) textParts.push(`Бренд: ${brand}`);
        if (category) textParts.push(`Категория: ${category}`);
        if (price > 0) textParts.push(`Цена: ${price}`);
        if (description) textParts.push(`Описание: ${description}`);
        
        for (const [k, v] of Object.entries(attributes)) {
            textParts.push(`${k}: ${v}`);
        }

        const rawText = textParts.join(' | ');

        return {
            sku,
            name,
            category,
            description,
            price,
            attributes,
            raw_text: rawText
        };
    };

    return rawData.map(normalizeRow);
}
