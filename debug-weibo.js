// Debug Weibo extraction - run in browser console
(function() {
  // Check what the scraper extracts
  const lists = document.querySelectorAll('.wbpro-list');
  console.log(`Found ${lists.length} wbpro-list containers`);
  
  lists.forEach((list, i) => {
    const item1 = list.querySelector('.item1');
    const item2s = list.querySelectorAll('.item2');
    
    if (item1) {
      const textEl = item1.querySelector('.text');
      const infoEl = item1.querySelector('.info');
      console.log(`\nList ${i}:`);
      console.log('  .text content:', textEl?.textContent?.substring(0, 100));
      console.log('  .info content:', infoEl?.textContent?.substring(0, 100));
      console.log('  Subreplies (.item2):', item2s.length);
      
      if (item2s.length > 0) {
        item2s.forEach((item2, j) => {
          const textEl2 = item2.querySelector('.text');
          console.log(`    Subreply ${j}:`, textEl2?.textContent?.substring(0, 80));
        });
      }
    }
  });
  
  // Check main post
  const mainPost = document.querySelector('article.woo-panel-main');
  if (mainPost) {
    const textEls = mainPost.querySelectorAll('[class*="text"], [class*="content"]');
    console.log('\nMain post text elements:', textEls.length);
    textEls.forEach((el, i) => {
      console.log(`  [${i}] ${el.className}:`, el.textContent?.substring(0, 50));
    });
  }
})();