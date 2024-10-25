chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchReward') {
        openAndFetchReward(request.siteUrl)
            .then(reward => {
                sendResponse({ reward });
            })
            .catch(error => {
                console.error('Error fetching reward:', error);
                sendResponse({ reward: 'Error' });
            });
        return true;
    }
});

// 打开一个新的标签页，静默获取 Reward 数据
async function openAndFetchReward(siteUrl) {
    return new Promise((resolve, reject) => {
        chrome.tabs.create({
            url: siteUrl,
            active: false,  // 设置为false，确保标签页不激活
            pinned: true    // 将标签页固定并最小化显示
        }, (tab) => {
            const tabId = tab.id;

            // 监听标签页加载完成
            chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, info) {
                if (tabId === tabIdUpdated && info.status === 'complete') {
                    // 执行抓取脚本
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: scrapeRewardData
                    }, (results) => {
                        const reward = results[0].result;
                        if (reward) {
                            resolve(reward);
                        } else {
                            resolve('Error: No score found');
                        }

                        // 关闭标签页
                        chrome.tabs.remove(tabId);
                    });

                    // 移除监听器
                    chrome.tabs.onUpdated.removeListener(listener);
                }
            });
        });
    });
}

// 这个函数会在标签页中执行
function scrapeRewardData() {
    const rewardElement = document.querySelector('.flex.items-start.gap-10.py-2:nth-of-type(5) > span:nth-of-type(2)');
    return rewardElement ? rewardElement.innerText : null;
}
