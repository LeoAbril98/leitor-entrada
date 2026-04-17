import fs from 'fs';
import path from 'path';

const fotosDir = path.join(process.cwd(), 'public', 'fotos');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function(file) {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  });

  return arrayOfFiles;
}

function buildMap() {
    const photoMap = {};

    const lines = fs.readdirSync(fotosDir, { withFileTypes: true });

    for (const line of lines) {
        if (line.isDirectory() && line.name !== 'PNEUS') {
            const linePath = path.join(fotosDir, line.name);
            const models = fs.readdirSync(linePath, { withFileTypes: true });

            for (const model of models) {
                if (model.isDirectory()) {
                    // Limpar espaços do final do nome da pasta apenas para garantir!
                    const modelName = model.name.toUpperCase().trim();
                    if (!photoMap[modelName]) photoMap[modelName] = {};

                    const modelPath = path.join(linePath, model.name);
                    const files = getAllFiles(modelPath);

                    const images = files.filter(f => /\.(png|jpe?g|webp|avif)$/i.test(f));
                    
                    for (const imgPath of images) {
                        const img = path.basename(imgPath);
                        // Extract abbreviation from filename
                        // Example: "C10 15X10  4F BD.png" -> "BD"
                        const parse = img.substring(0, img.lastIndexOf('.')).trim().split(/\s+/);
                        let abbr = parse.pop().toUpperCase();
                        
                        // Fix things like "B.png" parsing into "B" as expected.
                        // A URL agora aponta para o Supabase Storage e usa .webp
                        // Aplicamos a mesma normalização (remover acentos) que no script de upload
                        const relativePath = path.relative(fotosDir, imgPath).replace(/\\/g, '/');
                        let webpPath = relativePath.substring(0, relativePath.lastIndexOf('.')) + '.webp';
                        webpPath = webpPath.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
                        webpPath = webpPath.replace(/[^\w\s\/\.\-]/g, ''); // Limpeza de caracteres especiais

                        const photoUrl = `https://udgntgnjsncuzrgifwpa.supabase.co/storage/v1/object/public/fotos/${webpPath}`;
                        
                        // Just keep the first one encountered for each abbreviation
                        if (!photoMap[modelName][abbr]) {
                            photoMap[modelName][abbr] = photoUrl;
                        }
                    }
                }
            }
        }
    }
    
    fs.writeFileSync('src/data/photoMap.json', JSON.stringify(photoMap, null, 2));
    console.log("Photo map rebuilt recursively! M16 contains:", Object.keys(photoMap["M16"] || {}));
    console.log("M30 contains:", Object.keys(photoMap["M30"] || {}));
}

buildMap();
