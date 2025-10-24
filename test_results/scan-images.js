const fs = require('fs');
const path = require('path');

// 配置
const ROOT_DIR = __dirname;
const OUTPUT_FILE = path.join(ROOT_DIR, 'image-data.json');

// Prompt定义
const PROMPTS = {
    '上衣': 'Based on the existing model: blonde shoulder-length hair, natural facial features, standing posture (feet shoulder-width apart, weight slightly shifted to one side, upright upper body, shoulders relaxed, gaze forward). Replace her current outfit with a clothes',
    '下装': 'Based on the existing model: blonde shoulder-length hair, natural facial features, standing posture (feet shoulder-width apart, weight slightly shifted to one side, upright upper body, shoulders relaxed, gaze forward). Replace her current outfit with a skirt/trousers',
    '外套': 'Based on the existing model: blonde shoulder-length hair, natural facial features, standing posture (feet shoulder-width apart, weight slightly shifted to one side, upright upper body, shoulders relaxed, gaze forward). Replace her current outfit with a coat'
};

// 扫描所有模型文件夹
function scanModelDirectories() {
    const imageData = {
        categories: {},
        models: []
    };

    try {
        const entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });

        // 过滤出模型文件夹（排除特殊文件夹）
        const modelDirs = entries
            .filter(entry => entry.isDirectory())
            .filter(entry => {
                const name = entry.name;
                return !name.startsWith('.') &&
                       name !== 'node_modules' &&
                       name !== '白底' &&
                       name !== '白底 copy';
            })
            .map(entry => entry.name);

        console.log(`找到 ${modelDirs.length} 个模型文件夹:`);
        modelDirs.forEach(dir => console.log(`  - ${dir}`));

        // 扫描每个模型文件夹
        modelDirs.forEach(modelDir => {
            const modelPath = path.join(ROOT_DIR, modelDir);
            const cleanModelName = modelDir.replace(/^√ /, '').replace(/（/g, '(').replace(/）/g, ')');

            // 添加到模型列表
            if (!imageData.models.includes(cleanModelName)) {
                imageData.models.push(cleanModelName);
            }

            // 查找白底文件夹（可能是"白底"或"白底_compressed"）
            let baseDir = null;
            if (fs.existsSync(path.join(modelPath, '白底'))) {
                baseDir = path.join(modelPath, '白底');
            } else if (fs.existsSync(path.join(modelPath, '白底_compressed'))) {
                baseDir = path.join(modelPath, '白底_compressed');
            }

            if (!baseDir) {
                console.log(`  ⚠️  ${modelDir} 没有找到白底文件夹`);
                return;
            }

            // 扫描服装类别文件夹
            try {
                const categoryEntries = fs.readdirSync(baseDir, { withFileTypes: true });
                const categoryDirs = categoryEntries
                    .filter(entry => entry.isDirectory())
                    .map(entry => entry.name);

                categoryDirs.forEach(category => {
                    const categoryPath = path.join(baseDir, category);

                    // 初始化类别
                    if (!imageData.categories[category]) {
                        imageData.categories[category] = {
                            _meta: {
                                prompt: PROMPTS[category] || '',
                                originalImage: null
                            }
                        };
                    }

                    // 查找原图（模特.png）
                    const modelImagePath = path.join(categoryPath, '模特.png');
                    if (fs.existsSync(modelImagePath) && !imageData.categories[category]._meta.originalImage) {
                        imageData.categories[category]._meta.originalImage = path.relative(ROOT_DIR, modelImagePath);
                    }

                    // 扫描类别下的所有图片
                    try {
                        const files = fs.readdirSync(categoryPath);
                        const imageFiles = files.filter(file =>
                            /\.(png|jpg|jpeg|webp)$/i.test(file) &&
                            !file.startsWith('.') &&
                            file !== '模特.png'
                        );

                        // 先按服装名分组（移除末尾数字）
                        const clothingGroups = {};
                        imageFiles.forEach(file => {
                            const fileName = path.parse(file).name;
                            // 移除末尾的数字（如果有）
                            const baseName = fileName.replace(/\d+$/, '');
                            const relativePath = path.relative(ROOT_DIR, path.join(categoryPath, file));

                            if (!clothingGroups[baseName]) {
                                clothingGroups[baseName] = [];
                            }
                            clothingGroups[baseName].push(relativePath);
                        });

                        // 处理每个服装组
                        Object.keys(clothingGroups).forEach(clothingName => {
                            const paths = clothingGroups[clothingName].sort(); // 排序确保顺序

                            // 初始化服装项
                            if (!imageData.categories[category][clothingName]) {
                                imageData.categories[category][clothingName] = {
                                    _clothingImage: null
                                };
                            }

                            // 查找服装原图（在白底_compressed文件夹中）
                            if (!imageData.categories[category][clothingName]._clothingImage) {
                                // 白底_compressed在test_results目录下
                                const compressedPath = path.join(ROOT_DIR, '白底_compressed', category);
                                if (fs.existsSync(compressedPath)) {
                                    const clothingImageFiles = fs.readdirSync(compressedPath).filter(file => {
                                        const fileName = path.parse(file).name;
                                        return fileName === clothingName && /\.(png|jpg|jpeg|webp)$/i.test(file);
                                    });
                                    if (clothingImageFiles.length > 0) {
                                        const absolutePath = path.join(compressedPath, clothingImageFiles[0]);
                                        imageData.categories[category][clothingName]._clothingImage =
                                            path.relative(ROOT_DIR, absolutePath);
                                    }
                                }
                            }

                            // 如果只有一张图，存储为字符串；多张则存储为数组
                            if (paths.length === 1) {
                                imageData.categories[category][clothingName][cleanModelName] = paths[0];
                            } else {
                                imageData.categories[category][clothingName][cleanModelName] = paths;
                            }
                        });

                        console.log(`  ✓ ${category}: 找到 ${imageFiles.length} 张图片`);
                    } catch (err) {
                        console.log(`  ⚠️  无法读取 ${categoryPath}: ${err.message}`);
                    }
                });
            } catch (err) {
                console.log(`  ⚠️  无法读取 ${baseDir}: ${err.message}`);
            }
        });

        // 统计信息
        console.log('\n扫描结果:');
        console.log(`  模型总数: ${imageData.models.length}`);
        console.log(`  类别总数: ${Object.keys(imageData.categories).length}`);

        let totalClothing = 0;
        let totalImages = 0;
        Object.keys(imageData.categories).forEach(category => {
            const clothingCount = Object.keys(imageData.categories[category]).length;
            totalClothing += clothingCount;
            Object.values(imageData.categories[category]).forEach(clothing => {
                totalImages += Object.keys(clothing).length;
            });
            console.log(`  ${category}: ${clothingCount} 件服装`);
        });
        console.log(`  服装总数: ${totalClothing}`);
        console.log(`  图片总数: ${totalImages}`);

        // 写入JSON文件
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(imageData, null, 2), 'utf8');
        console.log(`\n✓ 数据已保存到: ${OUTPUT_FILE}`);

        return imageData;
    } catch (error) {
        console.error('扫描失败:', error);
        return null;
    }
}

// 执行扫描
console.log('开始扫描图片文件...\n');
scanModelDirectories();
