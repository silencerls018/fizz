// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchReward') {
        const rewardElement = document.querySelector('.flex.items-start.gap-10.py-2:nth-of-type(5) > span:nth-of-type(2)');
        
        if (rewardElement) {
            sendResponse({ reward: rewardElement.innerText }); // 返回分数
        } else {
            sendResponse({ reward: 'Error' });
        }
    }
});
