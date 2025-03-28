const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { distance } = require('fastest-levenshtein');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Load Ozon and Wildberries category data
let ozonCategories = [];
let wbCategories = [];

// Function to get the data directory path
function getDataDir() {
    // Check if running in Docker (using environment variable)
    if (process.env.DATA_DIR) {
        return process.env.DATA_DIR;
    }
    // Default to parent directory when running locally
    return path.join(__dirname, '..');
}

// Function to load category data
function loadCategoryData() {
    try {
        const dataDir = getDataDir();
        console.log(`Loading data from directory: ${dataDir}`);
        
        // Load Ozon categories
        try {
            const ozonData = fs.readFileSync(path.join(dataDir, 'ozon_category.json'), 'utf8');
            const ozonParsed = JSON.parse(ozonData);
            
            // Flatten the Ozon category structure
            // The structure is { "result": [...] } not { "categories": [...] }
            ozonCategories = flattenOzonCategories(ozonParsed.result || []);
            console.log(`Loaded and flattened ${ozonCategories.length} Ozon categories`);
        } catch (ozonErr) {
            console.error('Error loading Ozon categories:', ozonErr);
            ozonCategories = [];
        }
        
        // Load Wildberries categories
        try {
            const wbData = fs.readFileSync(path.join(dataDir, 'category.json'), 'utf8');
            const wbParentsData = fs.readFileSync(path.join(dataDir, 'parents_category.json'), 'utf8');
            
            const wbRawCategories = JSON.parse(wbData);
            const wbParents = JSON.parse(wbParentsData);
            
            // Process WB categories to include parent info
            if (wbRawCategories.data && Array.isArray(wbRawCategories.data)) {
                wbCategories = wbRawCategories.data.map(category => {
                    const parent = wbParents.data && Array.isArray(wbParents.data) ? 
                        wbParents.data.find(p => p.id === category.parentID) : null;
                    
                    // Handle inconsistent casing in the field names
                    // Some categories use subjectID (uppercase) and others might use subjectId (lowercase)
                    const categoryId = category.subjectId !== undefined ? category.subjectId : category.subjectID;
                    
                    if (categoryId === undefined) {
                        console.log('Warning: Category missing both subjectId and subjectID:', category);
                    }
                    
                    return {
                        id: categoryId, // Use the extracted ID regardless of casing
                        name: category.subjectName,
                        parentId: category.parentID,
                        parentName: parent ? parent.name : ''
                    };
                });
                console.log(`Loaded ${wbCategories.length} Wildberries categories`);
            } else {
                console.warn('Wildberries categories data is not in the expected format');
                wbCategories = [];
            }
        } catch (wbErr) {
            console.error('Error loading Wildberries categories:', wbErr);
            wbCategories = [];
        }
    } catch (err) {
        console.error('Error in loadCategoryData:', err);
    }
}

// Function to flatten nested Ozon categories
function flattenOzonCategories(categories, parentPath = '') {
    let flattened = [];
    
    categories.forEach(category => {
        // Add current category
        const currentPath = parentPath ? `${parentPath} > ${category.category_name}` : category.category_name;
        
        flattened.push({
            id: category.description_category_id,
            name: category.category_name,
            path: currentPath,
            disabled: category.disabled || false
        });
        
        // Process subcategories if any
        if (category.children && category.children.length > 0) {
            // Process subcategories (categories, not types)
            const subcategories = category.children.filter(child => child.category_name);
            if (subcategories.length > 0) {
                flattened = flattened.concat(flattenOzonCategories(subcategories, currentPath));
            }
            
            // Process types if any
            const types = category.children.filter(child => child.type_name);
            types.forEach(type => {
                flattened.push({
                    id: type.type_id,
                    name: type.type_name,
                    path: `${currentPath} > ${type.type_name}`,
                    isType: true
                });
            });
        }
    });
    
    return flattened;
}

// Helper function to normalize text for better comparison
function normalizeText(text) {
    return text.toLowerCase()
        .replace(/[^a-zа-яё0-9\s]/gi, '') // Remove special characters
        .replace(/\s+/g, ' ')             // Replace multiple spaces with single space
        .trim();                          // Trim whitespace
}

// Calculate string similarity (0-1 scale)
function calculateSimilarity(str1, str2) {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    // If strings match exactly after normalization
    if (s1 === s2) return 1.0;
    
    // If one string is empty after normalization
    if (s1.length === 0 || s2.length === 0) return 0.0;
    
    const maxLength = Math.max(s1.length, s2.length);
    const levenshteinDist = distance(s1, s2);
    
    return 1.0 - (levenshteinDist / maxLength);
}

// Endpoint for exact matching
app.post('/api/map/exact', (req, res) => {
    console.log('Received exact mapping request');
    
    // Ensure categories are loaded
    if (ozonCategories.length === 0 || wbCategories.length === 0) {
        loadCategoryData();
    }
    
    // Create a map of normalized WB category names to their objects
    const wbCategoryMap = new Map();
    wbCategories.forEach(category => {
        const normalizedName = normalizeText(category.name);
        wbCategoryMap.set(normalizedName, category);
    });
    
    // Match Ozon categories with Wildberries categories
    const mappings = [];
    
    ozonCategories.forEach(ozonCategory => {
        const normalizedOzonName = normalizeText(ozonCategory.name);
        
        // Look for exact match
        if (wbCategoryMap.has(normalizedOzonName)) {
            const wbCategory = wbCategoryMap.get(normalizedOzonName);
            
            // Make sure wbId is correctly set
            const mapping = {
                ozonId: ozonCategory.id,
                ozonName: ozonCategory.name,
                ozonPath: ozonCategory.path || '',
                wbId: wbCategory.id,     // This should be the WB category ID
                wbName: wbCategory.name,
                wbParent: wbCategory.parentName
            };
            
            // Debug logging to ensure wbId is present
            if (mapping.wbId === undefined) {
                console.warn('Warning: Missing wbId in mapping:', mapping, 'Original wbCategory:', wbCategory);
            }
            
            mappings.push(mapping);
        }
    });
    
    console.log(`Exact mapping complete. Found ${mappings.length} matches.`);
    res.json({ success: true, mappings, count: mappings.length });
});

// Endpoint for fuzzy matching
app.post('/api/map/fuzzy', (req, res) => {
    const { threshold = 0.7 } = req.body;
    console.log(`Received fuzzy mapping request with threshold ${threshold}`);
    
    // Ensure categories are loaded
    if (ozonCategories.length === 0 || wbCategories.length === 0) {
        loadCategoryData();
    }
    
    // Match Ozon categories with Wildberries categories based on similarity
    const mappings = [];
    
    // Index Wildberries categories by first letter for faster lookups
    const wbCategoriesByFirstLetter = new Map();
    wbCategories.forEach(category => {
        const normalizedName = normalizeText(category.name);
        if (normalizedName.length > 0) {
            const firstLetter = normalizedName[0];
            if (!wbCategoriesByFirstLetter.has(firstLetter)) {
                wbCategoriesByFirstLetter.set(firstLetter, []);
            }
            wbCategoriesByFirstLetter.get(firstLetter).push(category);
        }
    });
    
    // For each Ozon category, find the best matching WB category
    ozonCategories.forEach(ozonCategory => {
        const normalizedOzonName = normalizeText(ozonCategory.name);
        if (normalizedOzonName.length === 0) return;
        
        let bestMatch = null;
        let bestSimilarity = threshold;
        
        // Only compare with WB categories starting with the same letter for efficiency
        // Plus a few categories with similar common first letters
        const firstLetter = normalizedOzonName[0];
        const similarFirstLetters = getSimilarLetters(firstLetter);
        
        const categoriesToCompare = [];
        for (const letter of [firstLetter, ...similarFirstLetters]) {
            if (wbCategoriesByFirstLetter.has(letter)) {
                categoriesToCompare.push(...wbCategoriesByFirstLetter.get(letter));
            }
        }
        
        // If threshold is lower, we need to compare with more categories
        if (threshold < 0.7) {
            // Add more categories to compare if threshold is low
            wbCategoriesByFirstLetter.forEach((cats, letter) => {
                if (letter !== firstLetter && !similarFirstLetters.includes(letter)) {
                    categoriesToCompare.push(...cats.slice(0, 100)); // Limit to first 100 for each letter
                }
            });
        }
        
        // Compare with selected WB categories
        for (const wbCategory of categoriesToCompare) {
            const normalizedWbName = normalizeText(wbCategory.name);
            
            // Quick pre-check to avoid expensive calculations
            if (Math.abs(normalizedOzonName.length - normalizedWbName.length) / Math.max(normalizedOzonName.length, normalizedWbName.length) > 0.5) {
                continue; // Skip if length difference is more than 50%
            }
            
            const similarity = calculateSimilarity(normalizedOzonName, normalizedWbName);
            
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = wbCategory;
            }
        }
        
        if (bestMatch) {
            // Make sure wbId is correctly set
            const mapping = {
                ozonId: ozonCategory.id,
                ozonName: ozonCategory.name,
                ozonPath: ozonCategory.path || '',
                wbId: bestMatch.id,     // This should be the WB category ID
                wbName: bestMatch.name,
                wbParent: bestMatch.parentName,
                similarity: bestSimilarity.toFixed(2) // Store the similarity score
            };
            
            // Debug logging to ensure wbId is present
            if (mapping.wbId === undefined) {
                console.warn('Warning: Missing wbId in fuzzy mapping:', mapping, 'Original bestMatch:', bestMatch);
            }
            
            mappings.push(mapping);
        }
    });
    
    // Sort mappings by similarity (highest first)
    mappings.sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity));
    
    console.log(`Fuzzy mapping complete. Found ${mappings.length} matches with threshold ${threshold}.`);
    res.json({ success: true, mappings, count: mappings.length });
});

// Helper function to get similar first letters for improved matching
function getSimilarLetters(letter) {
    const similarLetterMap = {
        'a': ['а'], 'b': ['б'], 'c': ['с'], 'e': ['е'], 
        'h': ['н'], 'k': ['к'], 'm': ['м'], 'o': ['о'], 
        'p': ['р'], 't': ['т'], 'x': ['х'], 'y': ['у'],
        'а': ['a'], 'б': ['b'], 'с': ['c'], 'е': ['e'],
        'н': ['h'], 'к': ['k'], 'м': ['m'], 'о': ['o'],
        'р': ['p'], 'т': ['t'], 'х': ['x'], 'у': ['y']
    };
    
    return similarLetterMap[letter] || [];
}

// Endpoint for checking server status
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', categoriesLoaded: ozonCategories.length > 0 && wbCategories.length > 0 });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Category mapping server running on port ${PORT}`);
    loadCategoryData();
});
