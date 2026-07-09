const fs = require('fs');
const css = fs.readFileSync('build/assets/css/styles.64478602.css', 'utf8');
const regex = /\[class\*\=?['"]?docMainContainer['"]?\][^\{]*\{[^}]*\}/g;
const matches = css.match(regex);
console.log(matches);
