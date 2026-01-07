// 📁 scripts/convert-models.js
import fs from "fs";
import path from "path";

const modelsDir = path.resolve("backend/src/models");

fs.readdirSync(modelsDir).forEach((file) => {
  if (!file.endsWith(".js")) return;

  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, "utf-8");

  // Skip already converted files
  if (content.includes("class ") && content.includes("extends Model")) {
    console.log(`✔ Already class-style: ${file}`);
    return;
  }

  // Only handle old sequelize.define
  if (content.includes("sequelize.define(")) {
    console.log(`⚡ Converting: ${file}`);

    // Ensure DataTypes/Model import
    if (!content.includes('import { DataTypes, Model } from "sequelize"')) {
      content = content.replace(
        /^(import .*?["']sequelize["'];?)/m,
        'import { DataTypes, Model } from "sequelize";'
      );
    }

    // Capture model name
    const matchName = content.match(/const (\w+)\s*=\s*sequelize\.define/);
    if (!matchName) {
      console.log(`  ⚠ Skipped (no define match): ${file}`);
      return;
    }
    const modelName = matchName[1];

    // Replace sequelize.define with Model.init
    content = content.replace(
      /const (\w+)\s*=\s*sequelize\.define\([^,]+,\s*({[\s\S]*?}),\s*({[\s\S]*?})\);/,
      `${modelName}.init($2, { sequelize, modelName: "${modelName}", ...$3 });`
    );

    // Wrap with class structure
    content = content.replace(
      /export default\s*\(\s*sequelize\s*,\s*DataTypes\s*\)\s*=>\s*{([\s\S]*)return (\w+);\s*};?/,
      `export default (sequelize) => {
  class ${modelName} extends Model {
    static associate(models) {
      // (associations preserved below)
    }
  }
$1return ${modelName};
};`
    );

    fs.writeFileSync(filePath, content, "utf-8");
  }
});
