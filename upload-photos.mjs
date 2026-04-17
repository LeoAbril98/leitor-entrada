import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Usando a chave que já está no .env.local

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: Credenciais do Supabase não encontradas no .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const bucketName = 'fotos';
const sourceDir = path.join(process.cwd(), 'public', 'fotos');

async function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];

  for (const file of files) {
    if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
      arrayOfFiles = await getAllFiles(path.join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, file));
    }
  }
  return arrayOfFiles;
}

async function migrate() {
  console.log("🚀 Iniciando migração e compressão de fotos...");
  
  if (!fs.existsSync(sourceDir)) {
    console.error("Pasta public/fotos não encontrada!");
    return;
  }

  const allFiles = await getAllFiles(sourceDir);
  const imageFiles = allFiles.filter(f => /\.(png|jpe?g|webp|avif)$/i.test(f));

  console.log(`📸 Encontradas ${imageFiles.length} imagens para processar.`);

  for (let i = 0; i < imageFiles.length; i++) {
    const filePath = imageFiles[i];
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, '/');
    
    // O destino na nuvem será o mesmo caminho, mas com extensão .webp
    // Vamos normalizar para remover acentos e caracteres que o Supabase rejeita
    let destPath = relativePath.substring(0, relativePath.lastIndexOf('.')) + '.webp';
    destPath = destPath.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
    destPath = destPath.replace(/[^\w\s\/\.\-]/g, ''); // Remove qualquer coisa que não seja letra, número, espaço, barra, ponto ou hífen

    try {
      console.log(`[${i + 1}/${imageFiles.length}] Processando: ${relativePath}`);

      // 1. Comprimir e converter para WebP em memória
      const buffer = await sharp(filePath)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true }) // Redimensiona para um tamanho web amigável
        .webp({ quality: 80 }) // Salva em WebP com 80% de qualidade
        .toBuffer();

      // 2. Subir para o Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(destPath, buffer, {
          contentType: 'image/webp',
          upsert: true
        });

      if (error) {
        console.error(`❌ Erro no upload de ${relativePath}:`, error.message);
      } else {
        console.log(`✅ Sucesso: ${destPath}`);
      }
    } catch (err) {
      console.error(`💥 Falha crítica em ${relativePath}:`, err.message);
    }
  }

  console.log("\n✨ Migração finalizada!");
  console.log("Agora você pode rodar 'node buildPhotosMap.mjs' para atualizar o mapeamento.");
}

migrate();
