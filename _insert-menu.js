const fs = require('fs');
const path = 'c:/Users/User/auran-nextjs/src/components/admin/AdminChrome.tsx';
let text = fs.readFileSync(path, 'utf8');
const target = "      { label: '홈 큐레이션', href: '/admin/home-curation', icon: '🏠' },";
const insert = "      { label: '세그먼트 케어', href: '/admin/segment-care', icon: '🌗' },";
if (text.includes(insert)) {
  console.log('Already inserted');
  process.exit(0);
}
if (!text.includes(target)) {
  console.log('Target not found');
  process.exit(1);
}
text = text.replace(target, target + '\n' + insert);
fs.writeFileSync(path, text, 'utf8');
console.log('Done');
