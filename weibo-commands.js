// Quick Weibo Analysis - Run these commands individually in console

// Command 1: Check if page uses structured or flat format
(function() {
  const lists = document.querySelectorAll('.wbpro-list');
  const structured = Array.from(lists).filter(l => l.querySelector('.item1, .item2')).length;
  const flat = lists.length - structured;
  console.log(`Format: ${structured} structured, ${flat} flat, ${lists.length} total`);
  return { structured, flat, total: lists.length };
})();

// Command 2: Examine first reply structure
(function() {
  const first = document.querySelector('.wbpro-list .item1');
  if (!first) return console.log("No .item1 found");
  console.log("First reply HTML:\n", first.outerHTML.substring(0, 400));
  return first.outerHTML;
})();

// Command 3: Check subreply structure  
(function() {
  const subs = document.querySelectorAll('.wbpro-list .item2');
  console.log(`Found ${subs.length} subreplies (.item2)`);
  if (subs.length > 0) {
    console.log("First subreply HTML:\n", subs[0].outerHTML.substring(0, 400));
  }
  return subs.length;
})();

// Command 4: Test what selectors work for text extraction
(function() {
  const testSelectors = [
    '.wbpro-list .item1 .text',
    '.wbpro-list .item1 .info', 
    '.wbpro-list .item1 a',
    '.wbpro-list .text',
    '.wbpro-list .item2 .text'
  ];
  
  testSelectors.forEach(selector => {
    const el = document.querySelector(selector);
    console.log(`${selector}: ${el ? '✓ ' + el.textContent?.substring(0, 30) : '✗ not found'}`);
  });
})();

// Command 5: Check main post
(function() {
  const main = document.querySelector('article.woo-panel-main, .weibo-main, [class*="main"]');
  if (main) {
    console.log("Main post classes:", main.className);
    console.log("Main post text preview:", main.textContent?.substring(0, 100));
  } else {
    console.log("Main post not found with standard selectors");
  }
})();