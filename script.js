// Global variables to store data
let ozonData = null;
let wbCategories = null;
let wbParents = null;
let currentPlatform = 'ozon';
let searchQuery = '';

// Mapping tool variables
let mappingData = {
    mappings: [],
    ozonSelected: null,
    wbSelected: null
};
let flattenedOzonCategories = [];
let flattenedWbCategories = [];

document.addEventListener('DOMContentLoaded', () => {
    // Fetch both datasets
    fetchAllData();
    
    // Initialize UI tabs
    initializeTabs();
    
    // Add category viewer event listeners
    document.getElementById('ozon-btn').addEventListener('click', () => switchPlatform('ozon'));
    document.getElementById('wb-btn').addEventListener('click', () => switchPlatform('wb'));
    
    // Search functionality for category viewer
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    searchBtn.addEventListener('click', () => {
        searchQuery = searchInput.value.toLowerCase().trim();
        renderCurrentPlatform();
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchQuery = searchInput.value.toLowerCase().trim();
            renderCurrentPlatform();
        }
    });
    
    // Add mapping tool event listeners
    initializeMappingTool();
});

function initializeTabs() {
    const viewerTab = document.getElementById('viewer-tab');
    const mapperTab = document.getElementById('mapper-tab');
    const viewerSection = document.getElementById('viewer-section');
    const mapperSection = document.getElementById('mapper-section');
    
    viewerTab.addEventListener('click', () => {
        viewerTab.classList.add('active');
        mapperTab.classList.remove('active');
        viewerSection.classList.add('active');
        mapperSection.classList.remove('active');
    });
    
    mapperTab.addEventListener('click', () => {
        mapperTab.classList.add('active');
        viewerTab.classList.remove('active');
        mapperSection.classList.add('active');
        viewerSection.classList.remove('active');
        
        // Initialize mapping data if not already done
        if (flattenedOzonCategories.length === 0 || flattenedWbCategories.length === 0) {
            prepareDataForMapping();
        }
        
        renderMappingTool();
    });
}

async function fetchAllData() {
    try {
        // Show loading message
        document.getElementById('categories-tree').innerHTML = `
            <div class="loading">
                <p>Загрузка данных...</p>
            </div>
        `;
        
        // Fetch Ozon data
        const ozonResponse = await fetch('ozon_category.json');
        ozonData = await ozonResponse.json();
        
        // Fetch Wildberries data (with error handling for each file separately)
        try {
            const wbCategoriesResponse = await fetch('category.json');
            if (wbCategoriesResponse.ok) {
                wbCategories = await wbCategoriesResponse.json();
            } else {
                console.warn('category.json not found or error loading');
                wbCategories = { data: [] };
            }
        } catch (wbCategoriesError) {
            console.warn('Error loading category.json:', wbCategoriesError);
            wbCategories = { data: [] };
        }
        
        try {
            const wbParentsResponse = await fetch('parents_category.json');
            if (wbParentsResponse.ok) {
                wbParents = await wbParentsResponse.json();
            } else {
                console.warn('parents_category.json not found or error loading');
                wbParents = { data: [] };
            }
        } catch (wbParentsError) {
            console.warn('Error loading parents_category.json:', wbParentsError);
            wbParents = { data: [] };
        }
        
        // Initial render
        renderCurrentPlatform();
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('categories-tree').innerHTML = `
            <div class="error">
                <p>Не удалось загрузить данные. Пожалуйста, попробуйте позже.</p>
                <p>Ошибка: ${error.message}</p>
            </div>
        `;
    }
}

function renderCurrentPlatform() {
    if (currentPlatform === 'ozon') {
        renderOzonCategories();
    } else {
        renderWildberriesCategories();
    }
}

function switchPlatform(platform) {
    // Update active button
    document.getElementById('ozon-btn').classList.toggle('active', platform === 'ozon');
    document.getElementById('wb-btn').classList.toggle('active', platform === 'wb');
    
    // Set current platform
    currentPlatform = platform;
    
    // Render the selected platform
    renderCurrentPlatform();
}

function renderOzonCategories() {
    if (!ozonData) return;
    
    const categoriesTree = document.getElementById('categories-tree');
    
    // Clear any existing content
    categoriesTree.innerHTML = '';
    
    // Filter by search query if needed
    let filteredCategories = ozonData.result;
    if (searchQuery) {
        filteredCategories = filterOzonCategories(filteredCategories, searchQuery);
    }
    
    if (filteredCategories.length === 0) {
        categoriesTree.innerHTML = `
            <div class="no-results">
                <p>Нет результатов для "${searchQuery}"</p>
            </div>
        `;
        return;
    }
    
    // Create and append the categories HTML
    filteredCategories.forEach(category => {
        const categoryElement = createOzonCategoryElement(category, 'main-category');
        categoriesTree.appendChild(categoryElement);
    });
    
    // Add event listeners for toggling categories
    addToggleListeners();
}

function renderWildberriesCategories() {
    if (!wbCategories || !wbParents) return;
    
    const categoriesTree = document.getElementById('categories-tree');
    
    // Clear any existing content
    categoriesTree.innerHTML = '';
    
    // Check if we have data
    if (!wbCategories.data.length || !wbParents.data.length) {
        categoriesTree.innerHTML = `
            <div class="error">
                <p>Данные Wildberries не найдены или не загружены.</p>
                <p>Убедитесь, что файлы category.json и parents_category.json существуют в корневой папке.</p>
            </div>
        `;
        return;
    }
    
    // Build a hierarchy from WB data
    const parentCategories = wbParents.data;
    
    // Filter parents and categories by search query if needed
    let filteredParents = parentCategories;
    let filteredCategories = wbCategories.data;
    
    if (searchQuery) {
        filteredCategories = wbCategories.data.filter(category => 
            category.subjectName.toLowerCase().includes(searchQuery) || 
            category.parentName.toLowerCase().includes(searchQuery)
        );
        
        // Get unique parent IDs from filtered categories
        const parentIds = new Set(filteredCategories.map(cat => cat.parentID));
        filteredParents = parentCategories.filter(parent => parentIds.has(parent.id));
    }
    
    if (filteredParents.length === 0) {
        categoriesTree.innerHTML = `
            <div class="no-results">
                <p>Нет результатов для "${searchQuery}"</p>
            </div>
        `;
        return;
    }
    
    // Create and append parent categories
    filteredParents.forEach(parent => {
        // Get all categories with this parent
        const childCategories = filteredCategories.filter(cat => cat.parentID === parent.id);
        if (childCategories.length > 0) {
            const parentElement = createWbParentElement(parent, childCategories);
            categoriesTree.appendChild(parentElement);
        }
    });
    
    // Add event listeners for toggling categories
    addToggleListeners();
}

function filterOzonCategories(categories, query) {
    return categories.filter(category => {
        // Check if the category name matches the query
        const categoryMatches = category.category_name.toLowerCase().includes(query);
        
        // Filter children recursively
        let filteredChildren = [];
        if (category.children && category.children.length > 0) {
            // Check for children that are subcategories
            const subcategories = category.children.filter(child => child.category_name);
            let matchingSubcategories = filterOzonCategories(subcategories, query);
            
            // Check for children that are type items
            const typeItems = category.children.filter(child => child.type_name);
            let matchingTypeItems = typeItems.filter(type => 
                type.type_name.toLowerCase().includes(query)
            );
            
            filteredChildren = [...matchingSubcategories, ...matchingTypeItems];
        }
        
        // Include this category if it matches or if any of its children match
        return categoryMatches || filteredChildren.length > 0;
    });
}

function createOzonCategoryElement(category, className) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = `category ${className}`;
    
    // Check if this is a main category or subcategory with children
    if (category.category_name) {
        // This is a category/subcategory
        categoryDiv.innerHTML = `
            <div class="category-header">
                <div class="category-toggle">${category.children && category.children.length > 0 ? '▶' : ''}</div>
                <div class="category-info">
                    <div class="category-name">${category.category_name}</div>
                    <div class="category-details">
                        <span class="id-tag">ID: ${category.description_category_id}</span>
                        ${category.disabled ? '<span class="disabled-tag">(Отключено)</span>' : '<span class="enabled-tag">(Активно)</span>'}
                    </div>
                </div>
            </div>
            <div class="children-container"></div>
        `;
        
        if (category.children && category.children.length > 0) {
            const childrenContainer = categoryDiv.querySelector('.children-container');
            
            category.children.forEach(child => {
                // Check if child is a subcategory or a type
                if (child.category_name) {
                    // This is a subcategory
                    const childElement = createOzonCategoryElement(child, 'sub-category');
                    childrenContainer.appendChild(childElement);
                } else if (child.type_name) {
                    // This is a type item
                    const typeElement = createOzonTypeElement(child);
                    childrenContainer.appendChild(typeElement);
                }
            });
        }
    } else if (category.type_name) {
        // This is directly a type item
        return createOzonTypeElement(category);
    }
    
    return categoryDiv;
}

function createWbParentElement(parent, childCategories) {
    const parentDiv = document.createElement('div');
    parentDiv.className = 'category main-category';
    
    parentDiv.innerHTML = `
        <div class="category-header">
            <div class="category-toggle">${childCategories.length > 0 ? '▶' : ''}</div>
            <div class="category-info">
                <div class="category-name">${parent.name}</div>
                <div class="category-details">
                    <span class="id-tag">ID: ${parent.id}</span>
                    ${parent.isVisible ? '<span class="enabled-tag">(Активно)</span>' : '<span class="disabled-tag">(Отключено)</span>'}
                </div>
            </div>
        </div>
        <div class="children-container"></div>
    `;
    
    const childrenContainer = parentDiv.querySelector('.children-container');
    
    // Sort child categories by name
    childCategories.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    
    // Add child categories
    childCategories.forEach(category => {
        const childElement = createWbCategoryElement(category);
        childrenContainer.appendChild(childElement);
    });
    
    return parentDiv;
}

function createWbCategoryElement(category) {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'type-item';
    
    categoryDiv.innerHTML = `
        <div class="type-info">
            <div class="type-name">${category.subjectName}</div>
            <div class="type-details">
                <span class="id-tag">ID: ${category.subjectID}</span>
                <span class="parent-tag">Parent ID: ${category.parentID}</span>
            </div>
        </div>
    `;
    
    return categoryDiv;
}

function createOzonTypeElement(type) {
    const typeDiv = document.createElement('div');
    typeDiv.className = 'type-item';
    typeDiv.innerHTML = `
        <div class="type-info">
            <div class="type-name">${type.type_name}</div>
            <div class="type-details">
                <span class="id-tag">ID: ${type.type_id}</span>
                ${type.disabled ? '<span class="disabled-tag">(Отключено)</span>' : '<span class="enabled-tag">(Активно)</span>'}
            </div>
        </div>
    `;
    
    return typeDiv;
}

function addToggleListeners() {
    const categoryHeaders = document.querySelectorAll('.category-header');
    
    categoryHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const category = header.closest('.category');
            category.classList.toggle('expanded');
            
            const toggle = header.querySelector('.category-toggle');
            if (toggle.textContent === '▶') {
                toggle.textContent = '▼';
            } else if (toggle.textContent === '▼') {
                toggle.textContent = '▶';
            }
        });
    });
}

// Mapping Tool Functions
function initializeMappingTool() {
    // Mapping panel search functionality
    document.getElementById('ozon-search').addEventListener('input', (e) => {
        const searchValue = e.target.value.toLowerCase().trim();
        filterMappingItems('ozon', searchValue);
    });
    
    document.getElementById('wb-search').addEventListener('input', (e) => {
        const searchValue = e.target.value.toLowerCase().trim();
        filterMappingItems('wb', searchValue);
    });
    
    // Connect/disconnect buttons
    document.getElementById('connect-btn').addEventListener('click', () => {
        createMapping();
    });
    
    document.getElementById('disconnect-btn').addEventListener('click', () => {
        removeMapping();
    });
    
    // Auto-map button
    document.getElementById('auto-map-btn').addEventListener('click', () => {
        autoMapCategories();
    });
    
    // Save and export buttons
    document.getElementById('save-mapping-btn').addEventListener('click', () => {
        saveMappingData();
    });
    
    document.getElementById('export-mapping-btn').addEventListener('click', () => {
        exportMappingAsJson();
    });
    
    document.getElementById('load-mapping-btn').addEventListener('click', () => {
        loadMappingData();
    });
    
    // Matching mode controls
    initializeMatchingModeControls();
}

function initializeMatchingModeControls() {
    const exactMatch = document.getElementById('exact-match');
    const fuzzyMatch = document.getElementById('fuzzy-match');
    const fuzzySettings = document.getElementById('fuzzy-settings');
    const similarityThreshold = document.getElementById('similarity-threshold');
    const thresholdValue = document.getElementById('threshold-value');
    
    // Show/hide fuzzy settings based on selected mode
    exactMatch.addEventListener('change', () => {
        fuzzySettings.classList.remove('visible');
    });
    
    fuzzyMatch.addEventListener('change', () => {
        fuzzySettings.classList.add('visible');
    });
    
    // Update threshold value display
    similarityThreshold.addEventListener('input', () => {
        thresholdValue.textContent = similarityThreshold.value;
    });
    
    // Initialize state
    if (fuzzyMatch.checked) {
        fuzzySettings.classList.add('visible');
    }
}

function prepareDataForMapping() {
    if (!ozonData || !wbCategories || !wbParents) return;
    
    // Flatten Ozon hierarchy
    flattenedOzonCategories = [];
    flattenOzonCategories(ozonData.result);
    
    // Prepare Wildberries categories
    flattenedWbCategories = wbCategories.data.map(cat => ({
        id: cat.subjectID,
        parentId: cat.parentID,
        name: cat.subjectName,
        parentName: cat.parentName
    }));
    
    // Sort both arrays by name
    flattenedOzonCategories.sort((a, b) => a.name.localeCompare(b.name));
    flattenedWbCategories.sort((a, b) => a.name.localeCompare(b.name));
}

function flattenOzonCategories(categories, parentPath = '') {
    categories.forEach(category => {
        if (category.category_name) {
            // This is a category/subcategory
            const path = parentPath ? `${parentPath} > ${category.category_name}` : category.category_name;
            flattenedOzonCategories.push({
                id: category.description_category_id,
                name: category.category_name,
                path: path,
                type: 'category',
                disabled: category.disabled
            });
            
            if (category.children && category.children.length > 0) {
                flattenOzonCategories(category.children, path);
            }
        } else if (category.type_name) {
            // This is a type item
            flattenedOzonCategories.push({
                id: category.type_id,
                name: category.type_name,
                path: parentPath ? `${parentPath} > ${category.type_name}` : category.type_name,
                type: 'type',
                disabled: category.disabled
            });
        }
    });
}

function renderMappingTool() {
    renderOzonMappingPanel();
    renderWbMappingPanel();
    renderMappingConnections();
    updateMappingStats();
}

function renderOzonMappingPanel() {
    const ozonPanel = document.getElementById('ozon-categories');
    ozonPanel.innerHTML = '';
    
    flattenedOzonCategories.forEach(category => {
        const isMapped = mappingData.mappings.some(mapping => mapping.ozonId === category.id);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = `mapping-item ozon-item ${isMapped ? 'mapped' : ''}`;
        itemDiv.dataset.id = category.id;
        itemDiv.dataset.type = 'ozon';
        
        itemDiv.innerHTML = `
            <div class="mapping-item-name">${category.name}</div>
            <div class="mapping-item-path">${category.path}</div>
            <div class="mapping-item-id">ID: ${category.id}</div>
        `;
        
        itemDiv.addEventListener('click', () => selectMappingItem('ozon', category.id));
        
        ozonPanel.appendChild(itemDiv);
    });
}

function renderWbMappingPanel() {
    const wbPanel = document.getElementById('wb-categories');
    wbPanel.innerHTML = '';
    
    flattenedWbCategories.forEach(category => {
        const isMapped = mappingData.mappings.some(mapping => mapping.wbId === category.id);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = `mapping-item wb-item ${isMapped ? 'mapped' : ''}`;
        itemDiv.dataset.id = category.id;
        itemDiv.dataset.type = 'wb';
        
        itemDiv.innerHTML = `
            <div class="mapping-item-name">${category.name}</div>
            <div class="mapping-item-path">${category.parentName}</div>
            <div class="mapping-item-id">ID: ${category.id}</div>
        `;
        
        itemDiv.addEventListener('click', () => selectMappingItem('wb', category.id));
        
        wbPanel.appendChild(itemDiv);
    });
}

function selectMappingItem(type, id) {
    // Clear previous selection of the same type
    document.querySelectorAll(`.${type}-item.selected`).forEach(item => {
        item.classList.remove('selected');
    });
    
    // Select the new item
    const selectedItem = document.querySelector(`.${type}-item[data-id="${id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // Update selected item in mapping data
    if (type === 'ozon') {
        mappingData.ozonSelected = id;
    } else {
        mappingData.wbSelected = id;
    }
}

function createMapping() {
    if (!mappingData.ozonSelected || !mappingData.wbSelected) {
        alert('Пожалуйста, выберите одну категорию Ozon и одну категорию Wildberries для сопоставления.');
        return;
    }
    
    // Check if either category is already mapped
    const existingOzonMapping = mappingData.mappings.find(mapping => mapping.ozonId === mappingData.ozonSelected);
    const existingWbMapping = mappingData.mappings.find(mapping => mapping.wbId === mappingData.wbSelected);
    
    if (existingOzonMapping) {
        if (!confirm(`Категория Ozon уже сопоставлена с категорией Wildberries. Хотите изменить сопоставление?`)) {
            return;
        }
        // Remove old mapping
        mappingData.mappings = mappingData.mappings.filter(mapping => mapping.ozonId !== mappingData.ozonSelected);
    }
    
    if (existingWbMapping) {
        if (!confirm(`Категория Wildberries уже сопоставлена с категорией Ozon. Хотите изменить сопоставление?`)) {
            return;
        }
        // Remove old mapping
        mappingData.mappings = mappingData.mappings.filter(mapping => mapping.wbId !== mappingData.wbSelected);
    }
    
    // Create new mapping
    const ozonCategory = flattenedOzonCategories.find(cat => cat.id === mappingData.ozonSelected);
    const wbCategory = flattenedWbCategories.find(cat => cat.id === mappingData.wbSelected);
    
    if (!ozonCategory || !wbCategory) {
        alert('Ошибка: не удалось найти выбранные категории.');
        return;
    }
    
    mappingData.mappings.push({
        ozonId: mappingData.ozonSelected,
        ozonName: ozonCategory.name,
        ozonPath: ozonCategory.path,
        wbId: mappingData.wbSelected,
        wbName: wbCategory.name,
        wbParent: wbCategory.parentName
    });
    
    // Update UI
    renderMappingTool();
}

function removeMapping() {
    if (!mappingData.ozonSelected && !mappingData.wbSelected) {
        alert('Пожалуйста, выберите категорию для удаления сопоставления.');
        return;
    }
    
    if (mappingData.ozonSelected) {
        mappingData.mappings = mappingData.mappings.filter(mapping => mapping.ozonId !== mappingData.ozonSelected);
    }
    
    if (mappingData.wbSelected) {
        mappingData.mappings = mappingData.mappings.filter(mapping => mapping.wbId !== mappingData.wbSelected);
    }
    
    // Update UI
    renderMappingTool();
}

function renderMappingConnections() {
    const connectionsList = document.getElementById('connections-container');
    connectionsList.innerHTML = '';
    
    mappingData.mappings.forEach(mapping => {
        const connectionDiv = document.createElement('div');
        connectionDiv.className = 'connection-item';
        connectionDiv.innerHTML = `
            <span class="connection-ozon">${shortenText(mapping.ozonName, 15)}</span>
            <span class="connection-arrow">↔</span>
            <span class="connection-wb">${shortenText(mapping.wbName, 15)}</span>
        `;
        connectionsList.appendChild(connectionDiv);
    });
    
    renderMappingList();
}

function renderMappingList() {
    const mappingList = document.getElementById('mapping-list');
    mappingList.innerHTML = '';
    
    mappingData.mappings.forEach(mapping => {
        const mappingEntryDiv = document.createElement('div');
        mappingEntryDiv.className = 'mapping-entry';
        
        // Determine if this was an exact match or fuzzy match
        const similarityInfo = mapping.similarity ? 
            `<div class="similarity-score">Сходство: ${mapping.similarity}</div>` : '';
        
        mappingEntryDiv.innerHTML = `
            <div class="mapping-entry-ozon">
                <div>${mapping.ozonName}</div>
                <div class="mapping-entry-id">ID: ${mapping.ozonId}</div>
            </div>
            <div class="mapping-entry-connection">
                ↔
                ${similarityInfo}
            </div>
            <div class="mapping-entry-wb">
                <div>${mapping.wbName}</div>
                <div class="mapping-entry-id">ID: ${mapping.wbId}</div>
            </div>
        `;
        mappingList.appendChild(mappingEntryDiv);
    });
}

function updateMappingStats() {
    const totalMappings = mappingData.mappings.length;
    const mappedOzonIds = new Set(mappingData.mappings.map(m => m.ozonId));
    const mappedWbIds = new Set(mappingData.mappings.map(m => m.wbId));
    
    const unmappedOzon = flattenedOzonCategories.length - mappedOzonIds.size;
    const unmappedWb = flattenedWbCategories.length - mappedWbIds.size;
    
    document.getElementById('total-mappings').textContent = totalMappings;
    document.getElementById('ozon-unmapped').textContent = unmappedOzon;
    document.getElementById('wb-unmapped').textContent = unmappedWb;
}

function filterMappingItems(type, query) {
    if (!query) {
        // Show all items if no query
        document.querySelectorAll(`.${type}-item`).forEach(item => {
            item.style.display = 'block';
        });
        return;
    }
    
    document.querySelectorAll(`.${type}-item`).forEach(item => {
        const nameEl = item.querySelector('.mapping-item-name');
        const pathEl = item.querySelector('.mapping-item-path');
        
        if (nameEl && pathEl) {
            const name = nameEl.textContent.toLowerCase();
            const path = pathEl.textContent.toLowerCase();
            
            if (name.includes(query) || path.includes(query)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        }
    });
}

// Notification System
function showNotification(type, title, message, duration = 5000) {
    const notificationContainer = document.getElementById('notification-container');
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Icons for different notification types
    const icons = {
        success: '✓',
        info: 'ℹ',
        warning: '⚠',
        error: '✕'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-title">
                <span class="icon">${icons[type]}</span>
                ${title}
            </div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close">×</button>
    `;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Close button functionality
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
        closeNotification(notification);
    });
    
    // Auto close after duration
    if (duration) {
        setTimeout(() => {
            if (notification.parentNode) {
                closeNotification(notification);
            }
        }, duration);
    }
    
    return notification;
}

function closeNotification(notification) {
    notification.classList.add('closing');
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300); // Match the duration of the slideOut animation
}

// Loading Overlay
function showLoading(message = 'Идет обработка...') {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingMessage = document.getElementById('loading-message');
    const progressBar = document.getElementById('progress-bar');
    
    // Reset progress bar
    progressBar.style.width = '0%';
    
    // Set message
    loadingMessage.textContent = message;
    
    // Show overlay
    loadingOverlay.classList.add('visible');
    
    return {
        updateProgress: (percent) => {
            progressBar.style.width = `${percent}%`;
        },
        updateMessage: (newMessage) => {
            loadingMessage.textContent = newMessage;
        },
        hide: () => {
            loadingOverlay.classList.remove('visible');
        }
    };
}

function autoMapCategories() {
    // Determine the matching mode
    const isExactMatch = document.getElementById('exact-match').checked;
    const similarityThreshold = isExactMatch ? 1.0 : parseFloat(document.getElementById('similarity-threshold').value);
    
    const matchingModeText = isExactMatch ? 'точное (буква в букву)' : `нестрогое (порог сходства: ${similarityThreshold})`;
    
    // Show confirmation notification
    const confirmNotification = showNotification(
        'info',
        'Автоматическое сопоставление',
        `Начать автоматическое сопоставление категорий? Режим: ${matchingModeText}`,
        0 // Doesn't auto-close
    );
    
    // Add custom buttons to the notification
    const notificationContent = confirmNotification.querySelector('.notification-content');
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'notification-buttons';
    
    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Начать';
    confirmButton.className = 'notification-button primary';
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Отмена';
    cancelButton.className = 'notification-button secondary';
    
    buttonContainer.appendChild(confirmButton);
    buttonContainer.appendChild(cancelButton);
    notificationContent.appendChild(buttonContainer);
    
    // Button actions
    cancelButton.addEventListener('click', () => {
        closeNotification(confirmNotification);
        showNotification('info', 'Отменено', 'Автоматическое сопоставление было отменено');
    });
    
    confirmButton.addEventListener('click', () => {
        closeNotification(confirmNotification);
        startMapping(isExactMatch, similarityThreshold);
    });
}

// API URL - configure based on where your server is running
// When running locally, use localhost:3000
// When running in Docker, the API is available at /api
const API_BASE_URL = window.location.hostname === 'localhost' ? 
    'http://localhost:3000/api' : 
    '/api';

// Function to call the server API
async function callMappingApi(endpoint, data = {}) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        throw error;
    }
}

function startMapping(isExactMatch, similarityThreshold) {
    // Clear existing mappings
    mappingData.mappings = [];
    
    // Show loading overlay
    const loader = showLoading('Подготовка к сопоставлению...');
    
    // Determine which API endpoint to call
    const endpoint = isExactMatch ? 'map/exact' : 'map/fuzzy';
    const requestData = isExactMatch ? {} : { threshold: similarityThreshold };
    
    // Update loader message based on matching mode
    const modeMessage = isExactMatch ? 
        'Выполняется точное сопоставление...' : 
        'Выполняется нестрогое сопоставление...'; 
    
    loader.updateMessage(modeMessage);
    loader.updateProgress(20);
    
    // Make API call
    callMappingApi(endpoint, requestData)
        .then(response => {
            // Update progress
            loader.updateProgress(80);
            loader.updateMessage('Получены результаты сопоставления');
            
            if (response.success) {
                // Save the mappings
                mappingData.mappings = response.mappings;
                
                // Update UI
                loader.updateMessage('Обновление интерфейса...');
                loader.updateProgress(90);
                
                renderMappingTool();
                
                // Show success notification
                setTimeout(() => {
                    loader.hide();
                    
                    showNotification(
                        'success',
                        'Сопоставление завершено',
                        `Найдено ${mappingData.mappings.length} соответствий`,
                        10000 // Show for 10 seconds
                    );
                    
                    if (mappingData.mappings.length === 0) {
                        // Show warning notification if no matches were found
                        showNotification(
                            'warning',
                            'Соответствия не найдены',
                            isExactMatch ? 
                                'Попробуйте использовать нестрогое сопоставление.' : 
                                'Попробуйте снизить порог сходства.',
                            10000
                        );
                    }
                }, 500);
            } else {
                throw new Error('Server reported failure');
            }
        })
        .catch(error => {
            // Hide loader
            loader.hide();
            
            // Show error notification
            showNotification(
                'error',
                'Ошибка сопоставления',
                `Произошла ошибка при обращении к серверу: ${error.message}`,
                0 // Don't auto-close
            );
            
            console.error('Mapping API error:', error);
        });
}

// Note: These client-side matching functions are no longer used
// The matching is now performed on the server for better performance
// Keeping the functions here as reference or for fallback

// Perform exact matching (case-insensitive)
function performExactMatching(loader = null) {
    console.log('This function is deprecated - matching now happens on the server');
    // Implementation removed - see server.js for the server-side implementation
}

// Perform fuzzy matching using similarity threshold
function performFuzzyMatching(threshold, loader = null) {
    console.log('This function is deprecated - matching now happens on the server');
    // Implementation removed - see server.js for the server-side implementation
}

function saveMappingData() {
    try {
        localStorage.setItem('categoryMappingData', JSON.stringify(mappingData.mappings));
        alert('Сопоставления успешно сохранены в локальное хранилище браузера.');
    } catch (error) {
        console.error('Error saving mapping data:', error);
        alert('Ошибка при сохранении данных: ' + error.message);
    }
}

function loadMappingData() {
    try {
        const savedData = localStorage.getItem('categoryMappingData');
        if (savedData) {
            mappingData.mappings = JSON.parse(savedData);
            renderMappingTool();
            alert('Сопоставления успешно загружены из локального хранилища браузера.');
        } else {
            alert('Нет сохраненных сопоставлений в локальном хранилище браузера.');
        }
    } catch (error) {
        console.error('Error loading mapping data:', error);
        alert('Ошибка при загрузке данных: ' + error.message);
    }
}

function exportMappingAsJson() {
    try {
        // Create a clean mapping object with just the essential data
        const exportData = mappingData.mappings.map(mapping => ({
            ozon: {
                id: mapping.ozonId,
                name: mapping.ozonName,
                path: mapping.ozonPath
            },
            wildberries: {
                id: mapping.wbId,
                name: mapping.wbName,
                parent: mapping.wbParent
            }
        }));
        
        // Convert to JSON
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Create download link
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'category_mappings.json';
        downloadLink.click();
        
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting mapping data:', error);
        alert('Ошибка при экспорте данных: ' + error.message);
    }
}

// Helper function
function shortenText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}
