document.addEventListener('DOMContentLoaded', () => {
    const websiteInput = document.getElementById('website-input');
    const nameInput = document.getElementById('name-input');
    const addWebsiteBtn = document.getElementById('add-website');
    const websiteList = document.getElementById('website-list');
    const updateAllBtn = document.getElementById('update-all');

    let savedWebsites = JSON.parse(localStorage.getItem('websites')) || [];
    savedWebsites.forEach(site => addWebsiteToList(site));

    addWebsiteBtn.addEventListener('click', () => {
        const websiteInputValue = websiteInput.value.trim();
        const name = nameInput.value.trim();

        if (websiteInputValue && name) {
            const website = `https://fizz.spheron.network/${websiteInputValue}/dashboard`;
            const site = { name, url: website, score: 'Score Not Retrieved', lastUpdate: null, previousScore: 0, pointsLast12Hours: 0 };
            savedWebsites.push(site);
            localStorage.setItem('websites', JSON.stringify(savedWebsites));
            addWebsiteToList(site);
            websiteInput.value = '';
            nameInput.value = '';
        }
    });

    updateAllBtn.addEventListener('click', () => {
        updateAllBtn.disabled = true; 
        updateAllBtn.textContent = 'Updating...'; 

        Promise.all(savedWebsites.map((site, index) => updateWebsiteScore(site, index)))
            .then(() => {
                updateAllBtn.textContent = 'Update All'; 
            })
            .catch(error => {
                console.error('Update Failed:', error);
            })
            .finally(() => {
                updateAllBtn.disabled = false; 
            });
    });

    function addWebsiteToList(site) {
        const listItem = document.createElement('div');
        listItem.classList.add('list-item');
        listItem.innerHTML = `
            <span class="item-name">${site.name}</span>
            <div class="button-group">
                <span class="score">${site.score}</span>
                <button class="update-btn" style="padding: 2px 5px; min-width: 25px;">Update</button>
                <button class="delete-btn" style="padding: 2px 5px; min-width: 25px;">Delete</button>
            </div>
            <div class="additional-info" style="display: flex; justify-content: space-between;">
                <span class="status" style="padding: 2px 5px; border-radius: 4px; color: #ffffff; font-weight: bold;"></span>
                <span class="last-update"></span>
                <span class="points-increased"></span>
                <span class="offline-warning"></span>
                <span class="points-last-12-hours"></span>
            </div>
        `;

        listItem.querySelector('.delete-btn').addEventListener('click', () => {
            removeWebsite(site.name, listItem);
        });

        listItem.querySelector('.update-btn').addEventListener('click', () => {
            updateWebsiteScore(site, null, listItem);
        });

        websiteList.appendChild(listItem);
        updateWebsiteLastUpdate(listItem, site);

        if (site.previousScore > 0) {
            listItem.querySelector('.score').textContent = site.previousScore;
        }
    }

    function updateWebsiteLastUpdate(listItem, site) {
        const lastUpdate = site.lastUpdate ? new Date(site.lastUpdate) : null;
        const now = new Date();

        if (lastUpdate) {
            const timeDiff = Math.abs(now - lastUpdate);
            const hours = Math.floor(timeDiff / (1000 * 60 * 60));
            const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
            listItem.querySelector('.last-update').textContent = `Last Updated: ${hours} hours ${minutes} minutes ${seconds} seconds ago`;
        } else {
            listItem.querySelector('.last-update').textContent = 'Never Updated';
        }
    }

    function updateWebsiteScore(site, index, listItem = null) {
        const targetListItem = listItem || websiteList.children[index];
        const now = new Date();
        targetListItem.querySelector('.score').textContent = 'Updating...';

        return fetchRewardData(site.url, site.name).then(rewardData => {
            const { status, score } = rewardData;

            // Update status
            const statusElement = targetListItem.querySelector('.status');
            statusElement.textContent = status; // Directly place the status text
            statusElement.style.backgroundColor = status === 'inactive' ? '#e74c3c' : '#2ecc71';
            statusElement.style.color = '#ffffff';
            statusElement.style.fontWeight = 'bold';

            // Update displayed score
            const currentScore = score !== undefined ? score : 'Score Not Retrieved';
            targetListItem.querySelector('.score').textContent = currentScore;

            if (currentScore !== 'Score Not Retrieved') {
                site.previousScore = parseInt(currentScore) || 0;
            }

            updateWebsiteLastUpdate(targetListItem, site);

            site.lastUpdate = now.toISOString();
            localStorage.setItem('websites', JSON.stringify(savedWebsites));
        }).catch(error => {
            targetListItem.querySelector('.score').textContent = 'Fetch Failed';
            console.error('Error fetching data:', error);
        });
    }

    function removeWebsite(name, listItem) {
        const index = savedWebsites.findIndex(site => site.name === name);
        if (index !== -1) {
            savedWebsites.splice(index, 1);
            localStorage.setItem('websites', JSON.stringify(savedWebsites));
            listItem.remove();
        }
    }

    function fetchRewardData(url, name) {
        return new Promise((resolve, reject) => {
            chrome.tabs.create({ url: url, active: false, pinned: true }, (tab) => {
                let retryAttempts = 2;
                const interval = setInterval(() => {
                    chrome.tabs.get(tab.id, (tabInfo) => {
                        if (tabInfo?.status === 'complete') {
                            clearInterval(interval);
                            checkForRewards(tab, resolve, reject, retryAttempts);
                        }
                    });
                }, 500);
            });
        });
    }

    function checkForRewards(tab, resolve, reject, retryAttempts) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: getRewardData
        }, (results) => {
            if (chrome.runtime.lastError || !results || !results[0]?.result) {
                if (retryAttempts > 0) {
                    retryAttempts--;
                    setTimeout(() => checkForRewards(tab, resolve, reject, retryAttempts), 1000); 
                } else {
                    reject('Fetch Failed');
                    chrome.tabs.remove(tab.id);
                }
            } else {
                resolve(results[0].result);
                chrome.tabs.remove(tab.id);
            }
        });
    }

    function getRewardData() {
        // Get status
        const statusElement = document.querySelector('.group.relative.flex.items-center .flex.items-center.justify-start.gap-x-2');
        const status = statusElement ? statusElement.textContent.trim() : 'Unknown Status';

        // Use div:nth-child(3) [title] selector to get the score
        const scoreElement = document.querySelector('div:nth-child(3) [title]'); 
        const score = scoreElement ? scoreElement.innerText.trim() : 'Score Not Retrieved';

        return { status, score };
    }

    // Periodically check points and update
    setInterval(() => {
        savedWebsites.forEach((site, index) => {
            if (site.lastUpdate) {
                const now = new Date();
                const lastUpdate = new Date(site.lastUpdate);
                const timeElapsed = (now - lastUpdate) / (1000 * 60 * 60);

                if (timeElapsed >= 12) {
                    site.pointsLast12Hours = 0;
                    localStorage.setItem('websites', JSON.stringify(savedWebsites));
                }
            }
        });
    }, 12 * 60 * 60 * 1000);
});
