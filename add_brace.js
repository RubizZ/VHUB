const fs = require('fs');
let content = fs.readFileSync('src/app/strategies/page.tsx', 'utf8');

const target = `                }

                ctx.restore();


            ctx.restore();`;

const replacement = `                }

                ctx.restore();
            }

            ctx.restore();`;

const targetNoCR = target.replace(/\r/g, '');
const regex = new RegExp(targetNoCR.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\n/g, '\\r?\\n'), 'g');
content = content.replace(regex, replacement);

fs.writeFileSync('src/app/strategies/page.tsx', content, 'utf8');
console.log("Done");
