// Weibo DOM Structure Analysis Commands
// Run these in the browser console on a weibo.com detail page

// 1. Find all post/reply containers
console.log("=== Post Containers ===");
const containers = document.querySelectorAll('article, .wbpro-list, [class*="list"], [class*="item"]');
console.log(`Found ${containers.length} potential containers`);

// 2. Analyze wbpro-list structure (the main reply container)
console.log("\n=== wbpro-list Structure ===");
const lists = document.querySelectorAll('.wbpro-list');
lists.forEach((list, i) => {
  const item1 = list.querySelector('.item1');
  const item2s = list.querySelectorAll('.item2');
  const hasItem1 = !!item1;
  const item2Count = item2s.length;
  
  // Check for nested structure
  const list2 = list.querySelector('.list2');
  
  console.log(`List ${i}:`, {
    hasItem1,
    item2Count,
    hasList2: !!list2,
    textPreview: item1?.textContent?.substring(0, 50) || list.textContent?.substring(0, 50)
  });
});

// 3. Detailed analysis of text structure
console.log("\n=== Text Content Analysis ===");
const firstList = document.querySelector('.wbpro-list');
if (firstList) {
  console.log("First list HTML structure:");
  console.log(firstList.outerHTML.substring(0, 500));
  
  console.log("\nItem1 structure:");
  const item1 = firstList.querySelector('.item1');
  if (item1) {
    console.log("item1 HTML:", item1.outerHTML.substring(0, 300));
    console.log("item1 text elements:", Array.from(item1.querySelectorAll('.text, .info, a, span')).map(el => ({
      class: el.className,
      tag: el.tagName,
      text: el.textContent?.substring(0, 30)
    })));
  }
  
  console.log("\nSubreplies (item2) structure:");
  const item2s = firstList.querySelectorAll('.item2');
  item2s.forEach((item2, i) => {
    console.log(`item2 ${i}:`, item2.outerHTML.substring(0, 300));
  });
}

// 4. Check if there's any flat text format (not structured)
console.log("\n=== Flat Text Check ===");
const allWbproLists = document.querySelectorAll('.wbpro-list');
let flatTextCount = 0;
let structuredCount = 0;
allWbproLists.forEach(list => {
  if (list.querySelector('.item1, .item2')) {
    structuredCount++;
  } else {
    flatTextCount++;
    console.log("Flat text list found:", list.textContent?.substring(0, 100));
  }
});
console.log(`Structured: ${structuredCount}, Flat: ${flatTextCount}`);

// 5. Main post structure
console.log("\n=== Main Post Structure ===");
const mainPost = document.querySelector('article.woo-panel-main, article.weibo-main, .weibo-main');
if (mainPost) {
  console.log("Main post found:");
  console.log("Classes:", mainPost.className);
  console.log("Text elements:", Array.from(mainPost.querySelectorAll('[class*="text"], [class*="content"]')).map(el => ({
    class: el.className,
    text: el.textContent?.substring(0, 50)
  })));
}

// 6. Suggest selectors
console.log("\n=== Recommended Selectors ===");
console.log(`
Based on this page:
- Main post: ${mainPost ? mainPost.tagName.toLowerCase() + (mainPost.className ? '.' + mainPost.className.split(' ')[0] : '') : 'not found'}
- Reply containers: .wbpro-list  
- Top-level replies: .item1
- Subreplies: .item2
- Reply text: ${firstList?.querySelector('.item1 .text') ? '.item1 .text (or .item2 .text)' : 'check child elements'}
- Author: ${firstList?.querySelector('.item1 a') ? '.item1 a (or .item2 a)' : 'check child elements'}
- Timestamp: ${firstList?.querySelector('.item1 .info') ? '.item1 .info' : 'check child elements'}
`);