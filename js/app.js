document.addEventListener('DOMContentLoaded', () => {
    // --- GLOBALS & STATE ---
    const supabaseUrl = 'https://tenrsatqfbzjxxdjtntg.supabase.co';
    const supabaseKey = 'sb_publishable_DmqjGOvT162j62BU2Ac_Yw_-PIkHj28';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    let currentUser = null;
    
    // Dates
    const today = new Date();
    let currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let calendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Data Caches
    let tasksData = [];
    let weeklyGoalsData = [];
    let monthlyNotesData = [];
    let reflectionData = null;

    // --- UTILS ---
    function formatDateYMD(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDateDisplay(dateObj) {
        return `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function generateUUID() {
        if (crypto && crypto.randomUUID) return crypto.randomUUID();
        return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    function showErrorToast(msg) {
        let toast = document.getElementById('error-toast');
        if(!toast) {
            toast = document.createElement('div');
            toast.id = 'error-toast';
            toast.style.position = 'fixed';
            toast.style.top = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = '#ef4444'; // Red
            toast.style.color = 'white';
            toast.style.padding = '12px 24px';
            toast.style.borderRadius = '8px';
            toast.style.zIndex = '9999';
            toast.style.fontWeight = 'bold';
            toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    function parseTimeStrToMinutes(timeStr) {
        if(!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h * 60) + m;
    }

    function autoResizeTextarea(el) {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    // --- UI ELEMENTS ---
    const navItems = document.querySelectorAll('.nav-item');
    const viewSections = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');
    const dateBadge = document.getElementById('current-date-display');
    const landingView = document.getElementById('landing-view');
    const appView = document.getElementById('app-view');

    const titleMap = {
        'dashboard': '대시보드',
        'monthly': '월간 캘린더',
        'weekly': '주간 로드맵',
        'daily': '일일 계획',
        'diary': '일기'
    };

    // --- NAVIGATION ---
    function switchView(viewName) {
        navItems.forEach(nav => nav.classList.remove('active'));
        const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if(targetNav) targetNav.classList.add('active');

        pageTitle.textContent = titleMap[viewName];
        viewSections.forEach(section => section.classList.remove('active'));
        
        const targetSection = document.getElementById(`view-${viewName}`);
        if (targetSection) targetSection.classList.add('active');

        if(viewName === 'daily') {
            dateBadge.style.display = 'block';
            dateBadge.textContent = formatDateDisplay(currentDate);
            renderTasks();
            renderDailyTimeline();
            renderWeeklyWidget();
        } else {
            dateBadge.style.display = 'none';
        }

        if(viewName === 'monthly') renderCalendar();
        if(viewName === 'weekly') renderWeeklyGoals();
        if(viewName === 'dashboard') renderTasks();
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => switchView(item.getAttribute('data-view')));
    });

    // --- AUTH LOGIC ---
    const authModal = document.getElementById('auth-modal');
    const authBtnPrimary = document.getElementById('btn-auth-submit');
    const btnLandingLogin = document.getElementById('btn-landing-login');
    const btnLandingSignup = document.getElementById('btn-landing-signup');
    const btnStartNow = document.getElementById('btn-start-now');
    const btnLogout = document.getElementById('btn-logout');
    
    function openModal(isLogin) {
        const modalTitle = document.getElementById('auth-modal-title');
        const toggleAuthMode = document.getElementById('toggle-auth-mode');
        const groupNickname = document.getElementById('group-nickname');
        
        modalTitle.textContent = isLogin ? '로그인' : '회원가입';
        toggleAuthMode.textContent = isLogin ? '회원가입' : '로그인';
        toggleAuthMode.previousSibling.textContent = isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? ';
        groupNickname.style.display = isLogin ? 'none' : 'block';
        authModal.classList.add('active');
    }

    if(btnLandingLogin) btnLandingLogin.addEventListener('click', () => openModal(true));
    if(btnLandingSignup) btnLandingSignup.addEventListener('click', () => openModal(false));
    if(btnStartNow) btnStartNow.addEventListener('click', () => openModal(false));
    
    const modalCloseBtn = document.querySelector('.modal-close');
    if(modalCloseBtn) modalCloseBtn.addEventListener('click', () => authModal.classList.remove('active'));
    
    const toggleAuthBtn = document.getElementById('toggle-auth-mode');
    if(toggleAuthBtn) {
        toggleAuthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(document.getElementById('auth-modal-title').textContent === '회원가입');
        });
    }

    authBtnPrimary.addEventListener('click', async () => {
        const isLogin = document.getElementById('auth-modal-title').textContent === '로그인';
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;
        const nickname = document.getElementById('auth-nickname').value.trim();
        
        if(!email || !password) return alert('이메일과 비밀번호를 입력해주세요.');
        if(!isLogin && !nickname) return alert('별명을 입력해주세요.');

        authBtnPrimary.textContent = '처리 중...';
        authBtnPrimary.disabled = true;

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                if (data.user) {
                    await supabase.from('profiles').insert([{ id: data.user.id, username: nickname }]);
                }
                alert('회원가입 완료! 나무처럼 쑥쑥 성장해봐요 🌱');
            }
        } catch (error) {
            alert('인증 에러: ' + error.message);
        } finally {
            authBtnPrimary.textContent = '계속하기';
            authBtnPrimary.disabled = false;
        }
    });

    if(btnLogout) btnLogout.addEventListener('click', async () => await supabase.auth.signOut());

    async function checkAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        handleSessionChange(session);
        supabase.auth.onAuthStateChange((_event, session) => handleSessionChange(session));
    }

    async function handleSessionChange(session) {
        if (session) {
            currentUser = session.user;
            authModal.classList.remove('active');
            landingView.style.display = 'none';
            appView.classList.add('active');
            
            const { data: profile } = await supabase.from('profiles').select('username').eq('id', currentUser.id).single();
            const displayName = profile?.username || currentUser.email.split('@')[0];
            document.getElementById('user-email-display').textContent = `🌱 ${displayName}님, 환영합니다!`;
            
            loadAllData();
        } else {
            currentUser = null;
            appView.classList.remove('active');
            landingView.style.display = 'flex';
        }
    }

    // --- DATA LOADING ---
    async function loadAllData() {
        if(!currentUser) return;
        try {
            const { data: tData } = await supabase.from('tasks').select('*');
            tasksData = tData || [];

            const { data: wData } = await supabase.from('weekly_goals').select('*').order('created_at', { ascending: true });
            weeklyGoalsData = wData || [];

            const { data: mData } = await supabase.from('monthly_notes').select('*');
            monthlyNotesData = mData || [];

            const { data: rData } = await supabase.from('reflections').select('*').eq('user_id', currentUser.id).single();
            reflectionData = rData || null;

            const dashTextarea = document.getElementById('dashboard-quick-note');
            const qcTask = tasksData.find(t => t.type === 'dashboard_note');
            if (qcTask && dashTextarea) dashTextarea.value = qcTask.title;

            const activeView = document.querySelector('.nav-item.active').getAttribute('data-view');
            switchView(activeView);
            renderReflection();
        } catch (e) { 
            console.error('Data load error:', e); 
            showErrorToast('데이터를 불러오는데 실패했습니다.');
        }
    }

    // --- MONTHLY CALENDAR ---
    const gridEl = document.getElementById('calendar-grid');
    const monthTitle = document.getElementById('calendar-month-title');
    
    function renderCalendar() {
        if(!gridEl) return;
        const y = calendarMonth.getFullYear();
        const m = calendarMonth.getMonth();
        monthTitle.textContent = `${y}년 ${m + 1}월`;

        while(gridEl.children.length > 7) gridEl.removeChild(gridEl.lastChild);

        const firstDay = new Date(y, m, 1).getDay();
        const daysInMonth = new Date(y, m + 1, 0).getDate();
        let dateCount = 1;
        const totalCells = (firstDay + daysInMonth > 35) ? 42 : 35;

        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';

            if (i >= firstDay && dateCount <= daysInMonth) {
                const cellDate = new Date(y, m, dateCount);
                const dateStr = formatDateYMD(cellDate);
                const isToday = dateStr === formatDateYMD(today);
                if(isToday) cell.classList.add('today');

                const noteData = monthlyNotesData.find(n => n.note_date === dateStr);
                const noteText = noteData ? noteData.content : '';

                cell.innerHTML = `
                    <div class="calendar-date-header">
                        <div class="calendar-date-num" data-date="${dateStr}">${dateCount}</div>
                        <button class="calendar-add-btn" data-date="${dateStr}" title="해당 날짜에 일정 추가"><i class="ph ph-plus"></i></button>
                    </div>
                    <textarea class="calendar-note-input" data-date="${dateStr}" placeholder="메모...">${noteText}</textarea>
                `;

                cell.querySelector('.calendar-date-num').addEventListener('click', () => {
                    currentDate = cellDate;
                    switchView('daily');
                });
                
                cell.querySelector('.calendar-add-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentDate = cellDate;
                    switchView('daily');
                    addTask('daily', dateStr);
                });

                const ta = cell.querySelector('textarea');
                ta.addEventListener('input', debounce(async (e) => {
                    await updateMonthlyNote(dateStr, e.target.value);
                }, 1000));

                dateCount++;
            } else {
                cell.classList.add('other-month');
            }
            gridEl.appendChild(cell);
        }
    }

    async function updateMonthlyNote(dateStr, content) {
        if(!currentUser) return;
        try {
            const existing = monthlyNotesData.find(n => n.note_date === dateStr);
            if(existing) {
                await supabase.from('monthly_notes').update({ content }).eq('id', existing.id);
                existing.content = content;
            } else {
                const { data } = await supabase.from('monthly_notes').insert([{
                    user_id: currentUser.id, note_date: dateStr, content: content
                }]).select();
                if(data && data[0]) monthlyNotesData.push(data[0]);
            }
        } catch(e) { 
            console.error('Note update error', e);
            showErrorToast('저장에 실패했습니다.');
        }
    }

    document.getElementById('btn-prev-month')?.addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() - 1); renderCalendar(); });
    document.getElementById('btn-next-month')?.addEventListener('click', () => { calendarMonth.setMonth(calendarMonth.getMonth() + 1); renderCalendar(); });

    // --- WEEKLY ROADMAP ---
    const weeklyGrid = document.getElementById('weekly-goals-grid');

    function renderWeeklyGoals() {
        if(!weeklyGrid) return;
        weeklyGrid.innerHTML = '';
        weeklyGoalsData.forEach(goal => {
            const card = document.createElement('div');
            card.className = `weekly-card ${goal.completed ? 'completed' : ''}`;
            
            let subSummary = '';
            if(goal.subtasks && goal.subtasks.length > 0) {
                const comp = goal.subtasks.filter(s => s.completed).length;
                subSummary = `<span style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; margin-left: 8px; flex-shrink: 0;">세부 ${comp}/${goal.subtasks.length}</span>`;
            }

            let subtasksHtml = '';
            if(goal.subtasks && goal.subtasks.length > 0) {
                subtasksHtml = goal.subtasks.map((st, idx) => `
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-left: 36px;">
                        <div class="checkbox sub-checkbox" data-idx="${idx}" style="width: 16px; height: 16px; margin: 0; background-color: ${st.completed ? 'var(--accent-green)' : 'white'}; border: 1px solid ${st.completed ? 'var(--accent-green)' : 'var(--border-color)'};">
                            ${st.completed ? '<i class="ph ph-check" style="color: white; font-size: 10px; position:absolute; left:2px; top:2px;"></i>' : ''}
                        </div>
                        <span style="font-size: 14px; ${st.completed ? 'text-decoration: line-through; color: var(--text-secondary);' : 'color: var(--text-primary);'}">${st.title}</span>
                    </div>
                `).join('');
            } else {
                subtasksHtml = `<div style="padding: 12px 36px; font-size: 13px; color: var(--text-secondary);">우측 연필 아이콘을 눌러 세부 단계를 추가해보세요.</div>`;
            }

            card.innerHTML = `
                <div class="weekly-card-main">
                    <div class="priority-dot dot-${goal.priority || 'normal'}"></div>
                    <div class="checkbox main-checkbox" style="margin-top: 2px;">
                        ${goal.completed ? '<i class="ph ph-check" style="color: white; font-size: 14px; position:absolute; left:1px; top:1px;"></i>' : ''}
                    </div>
                    <div style="flex: 1; display:flex; align-items:center;" class="title-container">
                        <textarea rows="1" class="inline-input goal-title-input" data-id="${goal.id}" placeholder="목표 입력..." style="background-color: transparent; width: 100%;">${goal.title}</textarea>
                        ${subSummary}
                    </div>
                    <div style="display:flex; align-items:center;" class="actions-container">
                        <select class="priority-select" style="margin-right: 8px;">
                            <option value="normal" ${goal.priority === 'normal' ? 'selected' : ''}>보통</option>
                            <option value="urgent" ${goal.priority === 'urgent' ? 'selected' : ''}>긴급</option>
                            <option value="relaxed" ${goal.priority === 'relaxed' ? 'selected' : ''}>여유</option>
                        </select>
                        <button class="icon-btn breakdown-weekly-btn" title="세분화"><i class="ph ph-pencil-simple"></i></button>
                        <button class="icon-btn delete-goal-btn" style="color: #ef4444;"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
                <div class="sub-tasks-container" style="padding-bottom: ${goal.subtasks && goal.subtasks.length > 0 ? '12px' : '0'};">
                    ${subtasksHtml}
                </div>
            `;

            card.querySelector('.title-container').addEventListener('click', (e) => {
                if(e.target.tagName !== 'TEXTAREA') {
                    card.classList.toggle('expanded');
                }
            });

            card.querySelectorAll('.sub-checkbox').forEach(chk => {
                chk.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const idx = parseInt(chk.getAttribute('data-idx'));
                    const newSub = [...goal.subtasks];
                    newSub[idx].completed = !newSub[idx].completed;
                    goal.subtasks = newSub;
                    renderWeeklyGoals();
                    renderWeeklyWidget();
                    try { await supabase.from('weekly_goals').upsert(goal); } 
                    catch(err) { showErrorToast('저장에 실패했습니다.'); }
                });
            });

            card.querySelector('.priority-select').addEventListener('change', async (e) => {
                goal.priority = e.target.value;
                renderWeeklyGoals();
                renderWeeklyWidget();
                try { await supabase.from('weekly_goals').upsert(goal); } 
                catch(err) { showErrorToast('저장에 실패했습니다.'); }
            });

            card.querySelector('.main-checkbox').addEventListener('click', async (e) => {
                e.stopPropagation();
                goal.completed = !goal.completed;
                renderWeeklyGoals();
                renderWeeklyWidget();
                try { await supabase.from('weekly_goals').upsert(goal); } 
                catch(err) { showErrorToast('상태 업데이트에 실패했습니다.'); }
            });

            const titleInput = card.querySelector('.inline-input');
            titleInput.addEventListener('input', function() { autoResizeTextarea(this); });
            setTimeout(() => autoResizeTextarea(titleInput), 0);

            titleInput.addEventListener('blur', async (e) => {
                const newTitle = e.target.value;
                if(newTitle !== goal.title) {
                    goal.title = newTitle;
                    renderWeeklyWidget();
                    try { await supabase.from('weekly_goals').upsert(goal); } 
                    catch(err) { showErrorToast('저장에 실패했습니다.'); }
                }
            });

            card.querySelector('.delete-goal-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if(!confirm('목표를 삭제하시겠습니까?')) return;
                weeklyGoalsData = weeklyGoalsData.filter(g => g.id !== goal.id);
                renderWeeklyGoals();
                renderWeeklyWidget();
                try { await supabase.from('weekly_goals').delete().eq('id', goal.id); } 
                catch(err) { showErrorToast('삭제에 실패했습니다.'); }
            });

            card.querySelector('.breakdown-weekly-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openBreakdownModal(goal.id, 'weekly');
            });

            weeklyGrid.appendChild(card);
        });
    }

    document.getElementById('btn-add-weekly-goal')?.addEventListener('click', async () => {
        if(!currentUser) { showErrorToast('로그인이 필요합니다.'); return; }
        
        const newGoal = {
            id: generateUUID(), user_id: currentUser.id, title: '', priority: 'normal',
            completed: false, subtasks: [], created_at: new Date().toISOString()
        };
        
        weeklyGoalsData.push(newGoal);
        renderWeeklyGoals();
        renderWeeklyWidget();
        
        try { await supabase.from('weekly_goals').insert([newGoal]); } 
        catch(e) { showErrorToast('목표 생성에 실패했습니다.'); }

        openBreakdownModal(newGoal.id, 'weekly');
    });

    // --- DAILY TASKS ---
    function renderWeeklyWidget() {
        const wList = document.getElementById('daily-weekly-widget-list');
        if(!wList) return;
        wList.innerHTML = '';
        if(weeklyGoalsData.length === 0) {
            wList.innerHTML = '<li class="weekly-widget-item" style="color:#aaa;">등록된 주간 목표가 없습니다.</li>';
            return;
        }
        weeklyGoalsData.forEach(goal => {
            wList.innerHTML += `
                <li class="weekly-widget-item ${goal.completed ? 'completed' : ''}">
                    <i class="ph ${goal.completed ? 'ph-check-square-offset' : 'ph-square'}"></i>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${goal.title || '새로운 목표'}</span>
                </li>
            `;
        });
    }

    function renderTasks() {
        const dailyList = document.getElementById('daily-task-list');
        const dashList = document.getElementById('dashboard-task-list');
        const currentDateStr = formatDateYMD(currentDate);

        if(dailyList) dailyList.innerHTML = '';
        if(dashList) dashList.innerHTML = '';

        const dashTasks = tasksData.filter(t => t.type === 'dashboard');
        const dailyTasks = tasksData.filter(t => t.type === 'daily' && t.task_date === currentDateStr);

        // Dashboard
        dashTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            li.innerHTML = `
                <div class="checkbox"></div>
                <textarea rows="1" class="inline-input task-title-input" data-id="${task.id}" placeholder="할 일 입력..." style="width: 100%;">${task.title}</textarea>
                <button class="icon-btn delete-task-btn" style="color: #ef4444;"><i class="ph ph-trash"></i></button>
            `;
            li.querySelector('.checkbox').addEventListener('click', () => updateTask(task.id, { completed: !task.completed }));
            
            const titleInput = li.querySelector('.task-title-input');
            titleInput.addEventListener('input', function() { autoResizeTextarea(this); });
            setTimeout(() => autoResizeTextarea(titleInput), 0);
            
            titleInput.addEventListener('blur', (e) => {
                if(e.target.value !== task.title) updateTask(task.id, { title: e.target.value });
            });
            li.querySelector('.delete-task-btn').addEventListener('click', () => deleteTask(task.id));
            if(dashList) dashList.appendChild(li);
        });

        // Daily Plan
        dailyTasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `adv-task-item ${task.completed ? 'completed' : ''}`; 
            li.dataset.taskId = task.id;
            li.style.border = 'none';
            li.style.boxShadow = '0 2px 8px rgba(0,0,0,0.03)';
            
            let subSummary = '';
            if(task.subtasks && task.subtasks.length > 0) {
                const comp = task.subtasks.filter(s => s.completed).length;
                subSummary = `<span style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; margin-left: 8px; cursor: pointer; flex-shrink: 0;">세부 ${comp}/${task.subtasks.length}</span>`;
            }

            let subtasksHtml = '';
            if(task.subtasks && task.subtasks.length > 0) {
                subtasksHtml = task.subtasks.map((st, idx) => `
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding-left: 36px;">
                        <div class="checkbox sub-checkbox" data-idx="${idx}" style="width: 16px; height: 16px; margin: 0; background-color: ${st.completed ? 'var(--accent-green)' : 'white'}; border: 1px solid ${st.completed ? 'var(--accent-green)' : 'var(--border-color)'};">
                            ${st.completed ? '<i class="ph ph-check" style="color: white; font-size: 10px; position:absolute; left:2px; top:2px;"></i>' : ''}
                        </div>
                        <span style="font-size: 14px; ${st.completed ? 'text-decoration: line-through; color: var(--text-secondary);' : 'color: var(--text-primary);'}">${st.title}</span>
                    </div>
                `).join('');
            } else {
                subtasksHtml = `<div style="padding: 12px 36px; font-size: 13px; color: var(--text-secondary);">우측 연필 아이콘을 눌러 세부 단계를 추가해보세요.</div>`;
            }

            li.innerHTML = `
                <div class="adv-task-main" style="padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                        <div style="display: flex; align-items: center; flex: 1;" class="title-container">
                            <div class="priority-dot dot-${task.priority || 'normal'}" style="margin-right: 12px; margin-top: 0;"></div>
                            <div class="checkbox main-checkbox" style="margin-right: 12px;">
                                ${task.completed ? '<i class="ph ph-check" style="color: white; font-size: 14px; position:absolute; left:1px; top:1px;"></i>' : ''}
                            </div>
                            <textarea rows="1" class="inline-input task-title-input" data-id="${task.id}" placeholder="새로운 할 일..." style="font-weight:600; width: 100%; background: transparent;">${task.title}</textarea>
                            ${subSummary}
                        </div>
                    </div>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; padding-left: 48px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="time" class="start-time-input" value="${task.start_time || ''}" style="border: 1px solid var(--border-color); border-radius: 4px; padding: 4px; font-size: 13px; font-family: inherit; color: var(--text-secondary);">
                            <span style="color: var(--text-secondary); font-size: 13px;">~</span>
                            <input type="time" class="end-time-input" value="${task.end_time || ''}" style="border: 1px solid var(--border-color); border-radius: 4px; padding: 4px; font-size: 13px; font-family: inherit; color: var(--text-secondary);">
                        </div>
                        <div style="display:flex; align-items:center; gap: 4px;">
                            <select class="priority-select" style="font-size: 13px; padding: 4px;">
                                <option value="normal" ${task.priority === 'normal' ? 'selected' : ''}>보통</option>
                                <option value="urgent" ${task.priority === 'urgent' ? 'selected' : ''}>긴급</option>
                                <option value="relaxed" ${task.priority === 'relaxed' ? 'selected' : ''}>여유</option>
                            </select>
                            <button class="icon-btn breakdown-btn" title="세분화"><i class="ph ph-pencil-simple"></i></button>
                            <button class="icon-btn delete-task-btn" style="color: #ef4444;"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                </div>
                <div class="sub-tasks-container" style="padding-bottom: ${task.subtasks && task.subtasks.length > 0 ? '12px' : '0'};">
                    ${subtasksHtml}
                </div>
            `;

            li.querySelector('.title-container').addEventListener('click', (e) => {
                if(e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT' && !e.target.closest('.checkbox')) {
                    li.classList.toggle('expanded');
                }
            });

            li.querySelectorAll('.sub-checkbox').forEach(chk => {
                chk.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(chk.getAttribute('data-idx'));
                    const newSub = [...task.subtasks];
                    newSub[idx].completed = !newSub[idx].completed;
                    updateTask(task.id, { subtasks: newSub });
                });
            });

            const startTimeInput = li.querySelector('.start-time-input');
            const endTimeInput = li.querySelector('.end-time-input');
            
            startTimeInput.addEventListener('change', (e) => { updateTask(task.id, { start_time: e.target.value }); });
            endTimeInput.addEventListener('change', (e) => { updateTask(task.id, { end_time: e.target.value }); });

            li.querySelector('.priority-select').addEventListener('change', (e) => updateTask(task.id, { priority: e.target.value }));
            li.querySelector('.main-checkbox').addEventListener('click', (e) => { e.stopPropagation(); updateTask(task.id, { completed: !task.completed }); });
            
            const titleInput = li.querySelector('.task-title-input');
            titleInput.addEventListener('input', function() { autoResizeTextarea(this); });
            setTimeout(() => autoResizeTextarea(titleInput), 0);

            titleInput.addEventListener('blur', (e) => {
                if(e.target.value !== task.title) updateTask(task.id, { title: e.target.value });
            });
            li.querySelector('.delete-task-btn').addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); });
            
            li.querySelector('.breakdown-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openBreakdownModal(task.id, 'daily');
            });

            if(dailyList) dailyList.appendChild(li);
        });

        renderDailyTimeline();
    }

    // --- VISUAL TIMELINE SYNC ---
    function renderDailyTimeline() {
        const timelineEl = document.getElementById('daily-timeline');
        if(!timelineEl) return;
        
        timelineEl.innerHTML = '';
        
        for(let h = 6; h <= 24; h++) {
            const hourStr = h === 24 ? '00:00' : String(h).padStart(2, '0') + ':00';
            const slot = document.createElement('div');
            slot.className = 'time-slot';
            slot.innerHTML = `<span class="time-label">${hourStr}</span><div class="time-content"></div>`;
            timelineEl.appendChild(slot);
        }

        const currentDateStr = formatDateYMD(currentDate);
        const dailyTasks = tasksData.filter(t => t.type === 'daily' && t.task_date === currentDateStr);
        
        dailyTasks.forEach(task => {
            if(!task.start_time || !task.end_time) return;
            
            const startMins = parseTimeStrToMinutes(task.start_time);
            const endMins = parseTimeStrToMinutes(task.end_time);
            if(startMins >= endMins) return;
            
            const timelineStartMins = 6 * 60;
            let renderStartMins = Math.max(startMins, timelineStartMins);
            let renderEndMins = endMins;
            
            if(renderEndMins <= timelineStartMins) return; 
            
            const topOffset = renderStartMins - timelineStartMins;
            const height = renderEndMins - renderStartMins;

            const block = document.createElement('div');
            block.className = `timeline-block`;
            block.dataset.taskId = task.id;
            
            if(task.priority === 'urgent') block.style.borderLeftColor = '#ef4444';
            else if(task.priority === 'relaxed') block.style.borderLeftColor = '#22c55e';

            if(task.completed) {
                block.style.opacity = '0.5';
                block.style.textDecoration = 'line-through';
            }

            block.style.top = `${topOffset}px`;
            block.style.height = `${height}px`;
            
            block.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px; padding-left: 42px; width: 100%;">
                    <span style="font-weight: bold; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${task.title}</span>
                    ${height >= 30 ? `<span style="font-size: 11px; color: var(--text-secondary);">${task.start_time} - ${task.end_time}</span>` : ''}
                </div>
            `;
            timelineEl.appendChild(block);
        });

        updateCurrentTimeHighlight();
    }

    function updateCurrentTimeHighlight() {
        const blocks = document.querySelectorAll('.timeline-block');
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const isToday = formatDateYMD(currentDate) === formatDateYMD(now);

        blocks.forEach(block => {
            block.classList.remove('active-now');
            if(!isToday) return;

            const taskId = block.dataset.taskId;
            const task = tasksData.find(t => t.id === taskId);
            if(task && task.start_time && task.end_time && !task.completed) {
                const s = parseTimeStrToMinutes(task.start_time);
                const e = parseTimeStrToMinutes(task.end_time);
                if(currentMins >= s && currentMins < e) {
                    block.classList.add('active-now');
                }
            }
        });
    }

    setInterval(updateCurrentTimeHighlight, 60000);

    // --- DB UPDATES ---
    async function updateTask(id, updates) {
        const taskIdx = tasksData.findIndex(t => t.id === id);
        if(taskIdx > -1) {
            tasksData[taskIdx] = { ...tasksData[taskIdx], ...updates };
            renderTasks();
            if(activeBreakdownId === id) renderBreakdownModal();
            try { 
                await supabase.from('tasks').upsert(tasksData[taskIdx]); 
            } catch(e) { showErrorToast('저장에 실패했습니다.'); }
        }
    }

    async function deleteTask(id) {
        if(!confirm('삭제하시겠습니까?')) return;
        tasksData = tasksData.filter(t => t.id !== id);
        renderTasks();
        try { await supabase.from('tasks').delete().eq('id', id); } 
        catch(e) { showErrorToast('삭제에 실패했습니다.'); }
    }

    async function addTask(type, targetDateStr = null) {
        if(!currentUser) { showErrorToast('로그인이 필요합니다.'); return; }
        
        const dateStr = targetDateStr || (type === 'daily' ? formatDateYMD(currentDate) : formatDateYMD(today));
        const newTask = {
            id: generateUUID(), user_id: currentUser.id, type: type, task_date: dateStr,
            title: '', priority: 'normal', completed: false, subtasks: [], created_at: new Date().toISOString()
        };

        tasksData.push(newTask);
        renderTasks();

        setTimeout(() => {
            const input = document.querySelector(`.task-title-input[data-id="${newTask.id}"]`);
            if(input) input.focus();
        }, 50);

        try { await supabase.from('tasks').insert([newTask]); } 
        catch(e) { showErrorToast('생성에 실패했습니다.'); }
    }

    document.getElementById('btn-add-daily-task')?.addEventListener('click', () => addTask('daily'));
    document.getElementById('btn-add-dash-task')?.addEventListener('click', () => addTask('dashboard'));

    // --- COMMON TASK BREAKDOWN MODAL ---
    const breakdownModal = document.getElementById('breakdown-modal');
    const breakdownTitleInput = document.getElementById('breakdown-main-title');
    const breakdownSublist = document.getElementById('breakdown-subtask-list');
    
    let activeBreakdownId = null;
    let activeBreakdownType = 'daily';

    function openBreakdownModal(id, type = 'daily') {
        activeBreakdownId = id;
        activeBreakdownType = type;
        renderBreakdownModal();
        breakdownModal.classList.add('active');
        
        setTimeout(() => {
            if(!breakdownTitleInput.value) breakdownTitleInput.focus();
            autoResizeTextarea(breakdownTitleInput);
        }, 100);
    }

    async function updateBreakdownItem(updates) {
        if(!activeBreakdownId) return;
        
        if (activeBreakdownType === 'daily') {
            await updateTask(activeBreakdownId, updates);
        } else {
            const idx = weeklyGoalsData.findIndex(g => g.id === activeBreakdownId);
            if(idx > -1) {
                weeklyGoalsData[idx] = { ...weeklyGoalsData[idx], ...updates };
                renderWeeklyGoals();
                renderWeeklyWidget();
                renderBreakdownModal();
                try { await supabase.from('weekly_goals').upsert(weeklyGoalsData[idx]); } 
                catch(e) { showErrorToast('저장 실패'); }
            }
        }
    }

    function renderBreakdownModal() {
        if(!activeBreakdownId) return;
        
        const list = activeBreakdownType === 'daily' ? tasksData : weeklyGoalsData;
        const item = list.find(t => t.id === activeBreakdownId);
        if(!item) return;
        
        breakdownTitleInput.value = item.title || '';
        breakdownSublist.innerHTML = '';
        
        const subtasks = item.subtasks || [];
        subtasks.forEach((st, idx) => {
            const li = document.createElement('li');
            li.style.display = 'flex'; li.style.alignItems = 'center'; li.style.gap = '12px'; li.style.padding = '8px';
            li.style.border = '1px solid var(--border-color)'; li.style.borderRadius = '8px'; li.style.backgroundColor = 'var(--bg-primary)';

            li.innerHTML = `
                <div class="checkbox" style="width: 20px; height: 20px; flex-shrink: 0; background-color: white; ${st.completed ? 'background-color: var(--accent-green); border-color: var(--accent-green);' : ''}">
                    ${st.completed ? '<i class="ph ph-check" style="color: white; font-size: 14px; position:absolute; left:1px; top:1px;"></i>' : ''}
                </div>
                <textarea rows="1" class="inline-input sub-title-input" placeholder="세부 단계 내용 입력..." style="flex:1; background: transparent; resize: none; overflow: hidden; ${st.completed ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${st.title}</textarea>
                <button class="icon-btn delete-sub-btn" style="color: #ef4444; padding: 4px;"><i class="ph ph-trash"></i></button>
            `;
            
            li.querySelector('.checkbox').addEventListener('click', () => {
                const newSub = [...(item.subtasks || [])];
                newSub[idx].completed = !newSub[idx].completed;
                updateBreakdownItem({ subtasks: newSub });
            });
            
            const subInput = li.querySelector('.sub-title-input');
            subInput.addEventListener('input', function() { autoResizeTextarea(this); });
            setTimeout(() => autoResizeTextarea(subInput), 0);

            subInput.addEventListener('blur', (e) => {
                if(e.target.value !== st.title) {
                    const newSub = [...(item.subtasks || [])];
                    newSub[idx].title = e.target.value;
                    updateBreakdownItem({ subtasks: newSub });
                }
            });
            
            li.querySelector('.delete-sub-btn').addEventListener('click', () => {
                const newSub = [...(item.subtasks || [])];
                newSub.splice(idx, 1);
                updateBreakdownItem({ subtasks: newSub });
            });
            
            breakdownSublist.appendChild(li);
        });
    }

    document.getElementById('btn-close-breakdown')?.addEventListener('click', () => { breakdownModal.classList.remove('active'); activeBreakdownId = null; });
    document.getElementById('btn-done-breakdown')?.addEventListener('click', () => { breakdownModal.classList.remove('active'); activeBreakdownId = null; });

    breakdownTitleInput?.addEventListener('input', function() { autoResizeTextarea(this); });
    breakdownTitleInput?.addEventListener('blur', (e) => { updateBreakdownItem({ title: e.target.value }); });

    document.getElementById('btn-add-subtask')?.addEventListener('click', () => {
        if(!activeBreakdownId) return;
        const list = activeBreakdownType === 'daily' ? tasksData : weeklyGoalsData;
        const item = list.find(t => t.id === activeBreakdownId);
        if(!item) return;

        const newSub = [...(item.subtasks || []), { title: '', completed: false }];
        updateBreakdownItem({ subtasks: newSub });
        
        setTimeout(() => {
            const inputs = breakdownSublist.querySelectorAll('.sub-title-input');
            if(inputs.length > 0) {
                inputs[inputs.length - 1].focus();
                autoResizeTextarea(inputs[inputs.length - 1]);
            }
        }, 50);
    });

    // --- REFLECTION ---
    function renderReflection() {
        if(!reflectionData) return;
        const emotionBtns = document.querySelectorAll('.emotion-btn');
        emotionBtns.forEach(b => b.classList.remove('active'));
        if (reflectionData.emotion_index !== null && emotionBtns[reflectionData.emotion_index]) {
            emotionBtns[reflectionData.emotion_index].classList.add('active');
        }
        
        document.getElementById('ref-q1').value = reflectionData.q1 || '';
        document.getElementById('ref-q2').value = reflectionData.q2 || '';
        document.getElementById('ref-q3').value = reflectionData.q3 || '';
    }

    async function saveReflection() {
        if(!currentUser) return;
        const emotionIndex = Array.from(document.querySelectorAll('.emotion-btn')).findIndex(btn => btn.classList.contains('active'));
        const payload = {
            user_id: currentUser.id, emotion_index: emotionIndex,
            q1: document.getElementById('ref-q1').value,
            q2: document.getElementById('ref-q2').value,
            q3: document.getElementById('ref-q3').value,
            updated_at: new Date().toISOString()
        };
        try {
            if(reflectionData && reflectionData.id) {
                await supabase.from('reflections').update(payload).eq('id', reflectionData.id);
            } else {
                const { data } = await supabase.from('reflections').insert([payload]).select();
                if(data) reflectionData = data[0];
            }
        } catch(e) { showErrorToast('저장에 실패했습니다.'); }
    }

    document.querySelectorAll('.emotion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            saveReflection();
        });
    });

    ['ref-q1', 'ref-q2', 'ref-q3'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', debounce(saveReflection, 1000));
    });

    const reflectionTabs = document.querySelectorAll('.tab-btn');
    const reflectionContents = document.querySelectorAll('.reflection-tab-content');
    reflectionTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            reflectionTabs.forEach(t => t.classList.remove('active'));
            reflectionContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-target')).classList.add('active');
        });
    });

    // START
    checkAuth();
});
