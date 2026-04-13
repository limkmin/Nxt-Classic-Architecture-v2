import React, { useState, useEffect, useRef } from "react";
import "./App.css";

const SERVER_URL = process.env.REACT_APP_SERVER_URL;

function App() {
  const [tab, setTab] = useState("profile");
  const [profileId, setProfileId] = useState(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [goalType, setGoalType] = useState("diet");
  const [experienceLevel, setExperienceLevel] = useState("beginner");
  const [weeklyWorkouts, setWeeklyWorkouts] = useState("3");

  const [routine, setRoutine] = useState(null);
  const [mealPlan, setMealPlan] = useState(null);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [feedback, setFeedback] = useState("");

  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [logCompleted, setLogCompleted] = useState(false);
  const [logNote, setLogNote] = useState("");

  const [profileLoading, setProfileLoading] = useState(false);
  const [routineLoading, setRoutineLoading] = useState(false);
  const [mealLoading, setMealLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [error, setError] = useState("");

  // Chat state
  const [chatMessages, setChatMessages] = useState([
    { role: "ai", text: "안녕하세요! AI 헬스 코치입니다. 운동이나 식단에 대해 궁금한 점을 물어보세요 💪" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (profileId) { fetchRoutine(); fetchMealPlan(); fetchLogs(); }
  }, [profileId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── API Functions ───
  const saveProfile = async () => {
    setProfileLoading(true); setError("");
    try {
      const res = await fetch(`${SERVER_URL}/profiles`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ height: parseFloat(height), weight: parseFloat(weight), goalType, experienceLevel, weeklyWorkouts: parseInt(weeklyWorkouts) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "프로필 저장 실패");
      setProfileId(data.id);
      setTab("routine");
    } catch (e) { setError(e.message); } finally { setProfileLoading(false); }
  };

  const generateRoutine = async () => {
    setRoutineLoading(true); setError("");
    try {
      const res = await fetch(`${SERVER_URL}/profiles/${profileId}/routine`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "루틴 생성 실패");
      setRoutine(data.routine);
    } catch (e) { setError(e.message); } finally { setRoutineLoading(false); }
  };

  const fetchRoutine = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/profiles/${profileId}/routine`);
      if (res.ok) { const d = await res.json(); if (d.routine) setRoutine(d.routine); }
    } catch (e) { console.error(e); }
  };

  const generateMealPlan = async () => {
    setMealLoading(true); setError("");
    try {
      const res = await fetch(`${SERVER_URL}/profiles/${profileId}/meal`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "식단 추천 실패");
      setMealPlan(data.mealPlan);
    } catch (e) { setError(e.message); } finally { setMealLoading(false); }
  };

  const fetchMealPlan = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/profiles/${profileId}/meal`);
      if (res.ok) { const d = await res.json(); if (d.mealPlan) setMealPlan(d.mealPlan); }
    } catch (e) { console.error(e); }
  };

  const saveWorkoutLog = async () => {
    setLogLoading(true); setError("");
    try {
      const res = await fetch(`${SERVER_URL}/profiles/${profileId}/logs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: logDate, completed: logCompleted, note: logNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "기록 저장 실패");
      setLogNote(""); setLogCompleted(false); await fetchLogs();
    } catch (e) { setError(e.message); } finally { setLogLoading(false); }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/profiles/${profileId}/logs`);
      if (res.ok) { const d = await res.json(); if (Array.isArray(d)) setWorkoutLogs(d); }
    } catch (e) { console.error(e); }
  };

  const requestFeedback = async () => {
    setFeedbackLoading(true); setError("");
    try {
      const res = await fetch(`${SERVER_URL}/profiles/${profileId}/feedback`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "피드백 요청 실패");
      const fb = typeof data.feedback === "object" ? data.feedback.feedback || JSON.stringify(data.feedback) : data.feedback;
      setFeedback(fb);
    } catch (e) { setError(e.message); } finally { setFeedbackLoading(false); }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setChatInput(""); setChatLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/profiles/${profileId}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "채팅 실패");
      const reply = typeof data.reply === "object" ? data.reply.reply || JSON.stringify(data.reply) : data.reply;
      setChatMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: "ai", text: "죄송합니다, 오류가 발생했습니다. 다시 시도해주세요." }]);
    } finally { setChatLoading(false); }
  };

  // ─── Render Helpers ───
  const renderRoutine = () => {
    if (!routine) return null;
    const data = typeof routine === "string" ? JSON.parse(routine) : routine;
    const plan = data.weeklyPlan || data.routine_data?.weeklyPlan || [];
    return (
      <div className="routine-grid">
        {plan.map((day, i) => (
          <div key={i} className={`routine-card ${day.isRestDay ? "rest-day" : ""}`}>
            <div className="routine-day">{day.day}</div>
            {day.isRestDay ? <p className="rest-label">휴식일 🛌</p> : (
              <>
                <div className="routine-body-part">💪 {day.bodyPart}</div>
                <ul className="exercise-list">
                  {(day.exercises || []).map((ex, j) => (
                    <li key={j}>{ex.name} · {ex.sets}세트 × {ex.reps}회</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderMealPlan = () => {
    if (!mealPlan) return null;
    const data = typeof mealPlan === "string" ? JSON.parse(mealPlan) : mealPlan;
    const meals = data.meals || data.meal_data?.meals || [];
    const cal = data.targetCalories || data.meal_data?.targetCalories;
    return (
      <>
        {cal && <div className="calories-badge">🎯 일일 목표 칼로리: {cal} kcal</div>}
        <div className="meal-grid">
          {meals.map((m, i) => (
            <div key={i} className="meal-card">
              <div className="meal-type">{m.type === "아침" ? "🌅" : m.type === "점심" ? "☀️" : "🌙"} {m.type}</div>
              <p className="meal-menu">{m.menu}</p>
              <p className="meal-kcal">{m.calories} kcal</p>
            </div>
          ))}
        </div>
      </>
    );
  };

  const tabs = [
    { id: "profile", label: "프로필", icon: "👤" },
    { id: "routine", label: "운동 루틴", icon: "🏋️" },
    { id: "meal", label: "식단", icon: "🥗" },
    { id: "log", label: "운동 기록", icon: "📝" },
    { id: "feedback", label: "AI 피드백", icon: "📊" },
    { id: "chat", label: "AI 챗봇", icon: "💬" },
  ];

  return (
    <div className="App">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🏋️</span>
            <div>
              <h1>FitCoach AI</h1>
              <span>맞춤형 운동 & 식단 코치</span>
            </div>
          </div>
          <nav className="nav-tabs">
            {tabs.map(t => (
              <button key={t.id} className={`nav-tab ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)} disabled={t.id !== "profile" && !profileId}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="container">
        {error && (
          <div className="error-banner">
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")}>✕</button>
          </div>
        )}

        {/* 프로필 */}
        {tab === "profile" && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">👤 프로필 설정</h2>
              {profileId && <span className="profile-badge">✅ 저장됨</span>}
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>키 (cm)</label>
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="170" disabled={!!profileId} />
              </div>
              <div className="form-group">
                <label>몸무게 (kg)</label>
                <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="70" disabled={!!profileId} />
              </div>
              <div className="form-group">
                <label>운동 목표</label>
                <select value={goalType} onChange={e => setGoalType(e.target.value)} disabled={!!profileId}>
                  <option value="diet">다이어트</option>
                  <option value="bulk">벌크업</option>
                  <option value="maintain">유지</option>
                </select>
              </div>
              <div className="form-group">
                <label>운동 경험</label>
                <select value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)} disabled={!!profileId}>
                  <option value="beginner">초보</option>
                  <option value="intermediate">중급</option>
                  <option value="advanced">고급</option>
                </select>
              </div>
              <div className="form-group">
                <label>주간 운동 횟수</label>
                <select value={weeklyWorkouts} onChange={e => setWeeklyWorkouts(e.target.value)} disabled={!!profileId}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}일</option>)}
                </select>
              </div>
            </div>
            {!profileId && (
              <button className="btn btn-primary" onClick={saveProfile} disabled={profileLoading || !height || !weight}>
                {profileLoading ? <><span className="spinner"></span> 저장 중...</> : "프로필 저장"}
              </button>
            )}
          </div>
        )}

        {/* 운동 루틴 */}
        {tab === "routine" && profileId && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">🏋️ 주간 운동 루틴</h2>
              <button className="btn btn-primary" onClick={generateRoutine} disabled={routineLoading}>
                {routineLoading ? <><span className="spinner"></span> 생성 중...</> : routine ? "다시 생성" : "루틴 생성"}
              </button>
            </div>
            {renderRoutine()}
          </div>
        )}

        {/* 식단 */}
        {tab === "meal" && profileId && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">🥗 맞춤 식단</h2>
              <button className="btn btn-accent" onClick={generateMealPlan} disabled={mealLoading}>
                {mealLoading ? <><span className="spinner"></span> 추천 중...</> : mealPlan ? "다시 추천" : "식단 추천"}
              </button>
            </div>
            {renderMealPlan()}
          </div>
        )}

        {/* 운동 기록 */}
        {tab === "log" && profileId && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📝 운동 기록</h2>
            </div>
            <div className="log-form">
              <div className="form-group">
                <label>날짜</label>
                <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input type="checkbox" checked={logCompleted} onChange={e => setLogCompleted(e.target.checked)} />
                  운동 완료
                </label>
              </div>
              <div className="form-group">
                <label>메모</label>
                <input type="text" value={logNote} onChange={e => setLogNote(e.target.value)} placeholder="오늘 운동 메모..." />
              </div>
              <button className="btn btn-primary" onClick={saveWorkoutLog} disabled={logLoading || !logDate}>
                {logLoading ? "저장 중..." : "기록 저장"}
              </button>
            </div>
            {workoutLogs.length > 0 && (
              <div className="log-list">
                {workoutLogs.map((log, i) => (
                  <div key={log.id || i} className="log-item">
                    <span className="log-date">{log.log_date?.split("T")[0] || log.date}</span>
                    <span className={`log-status ${log.completed ? "done" : "missed"}`}>
                      {log.completed ? "✅ 완료" : "❌ 미완료"}
                    </span>
                    {log.note && <span className="log-note">{log.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI 피드백 */}
        {tab === "feedback" && profileId && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📊 AI 피드백</h2>
              <button className="btn btn-primary" onClick={requestFeedback} disabled={feedbackLoading}>
                {feedbackLoading ? <><span className="spinner"></span> 분석 중...</> : "피드백 요청"}
              </button>
            </div>
            {feedback && <div className="feedback-box">{feedback}</div>}
          </div>
        )}

        {/* AI 챗봇 */}
        {tab === "chat" && profileId && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">💬 AI 헬스 챗봇</h2>
            </div>
            <div className="chatbot-container">
              <div className="chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.role}`}>{msg.text}</div>
                ))}
                {chatLoading && <div className="chat-msg ai loading">답변을 생성하고 있습니다...</div>}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-area">
                <input className="chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendChat()}
                  placeholder="운동이나 식단에 대해 물어보세요..." disabled={chatLoading} />
                <button className="chat-send" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>전송</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
