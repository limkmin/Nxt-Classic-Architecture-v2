require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const axios = require("axios");
const cors = require("cors");
const { validateProfile, validateWorkoutLog } = require("./validators");

const app = express();
const port = 80;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 데이터베이스 연결 상태를 저장할 변수
let dbConnection = null;

// 테이블 생성 함수
const createTables = (connection) => {
  const queries = [
    `CREATE TABLE IF NOT EXISTS user_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      height DECIMAL(5,1) NOT NULL,
      weight DECIMAL(5,1) NOT NULL,
      goal_type ENUM('diet', 'bulk', 'maintain') NOT NULL,
      experience_level ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
      weekly_workouts INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS workout_routines (
      id INT AUTO_INCREMENT PRIMARY KEY,
      profile_id INT NOT NULL,
      routine_data JSON NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS meal_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      profile_id INT NOT NULL,
      meal_data JSON NOT NULL,
      total_calories INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS workout_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      profile_id INT NOT NULL,
      log_date DATE NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_profile_date (profile_id, log_date),
      FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON DELETE CASCADE
    )`,
  ];

  return queries.reduce((promise, query) => {
    return promise.then(() => {
      return new Promise((resolve, reject) => {
        connection.query(query, (err, result) => {
          if (err) {
            console.error("테이블 생성 중 오류:", err);
            reject(err);
            return;
          }
          resolve(result);
        });
      });
    });
  }, Promise.resolve());
};

// 데이터베이스 연결 함수
const connectToDatabase = () => {
  try {
    const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );

    if (missingEnvVars.length > 0) {
      console.error(
        "필수 데이터베이스 환경변수가 없습니다:",
        missingEnvVars.join(", "),
      );
      return Promise.reject(new Error("필수 환경변수 누락"));
    }

    const connection = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    return new Promise((resolve, reject) => {
      connection.connect(async (err) => {
        if (err) {
          console.error("데이터베이스 연결 실패:", err);
          reject(err);
          return;
        }

        console.log("데이터베이스 연결 성공");

        try {
          await createTables(connection);
          console.log("테이블 준비 완료");
          dbConnection = connection;
          resolve(connection);
        } catch (error) {
          console.error("테이블 생성 실패:", error);
          reject(error);
        }
      });
    });
  } catch (error) {
    console.error("데이터베이스 연결 중 오류:", error);
    return Promise.reject(error);
  }
};

// DB 연결 상태 체크 미들웨어
const checkDbConnection = (req, res, next) => {
  if (!dbConnection) {
    return res.status(503).json({
      error: "데이터베이스 연결 실패",
      message:
        "현재 데이터베이스 서비스를 이용할 수 없습니다. 잠시 후 다시 시도해주세요.",
    });
  }
  next();
};

// 기본 경로 (상태 표시)
app.get("/", (req, res) => {
  res.json({
    message: "서버 실행 중",
    status: {
      database: dbConnection ? "연결됨" : "연결 안됨",
      gemini_lambda_url: process.env.GEMINI_LAMBDA_URL ? "설정됨" : "설정 안됨",
    },
  });
});

// POST /profiles - 프로필 등록
app.post("/profiles", checkDbConnection, (req, res) => {
  const validation = validateProfile(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: "유효성 검증 실패", fields: validation.errors });
  }

  const { height, weight, goalType, experienceLevel, weeklyWorkouts } = req.body;
  const query =
    "INSERT INTO user_profiles (height, weight, goal_type, experience_level, weekly_workouts) VALUES (?, ?, ?, ?, ?)";

  dbConnection.query(
    query,
    [height, weight, goalType, experienceLevel, weeklyWorkouts],
    (err, result) => {
      if (err) {
        console.error("프로필 저장 실패:", err);
        return res.status(500).json({ error: "데이터 처리 실패" });
      }
      res.status(201).json({ id: result.insertId, message: "프로필이 등록되었습니다" });
    }
  );
});

// GET /profiles/:id - 프로필 조회
app.get("/profiles/:id", checkDbConnection, (req, res) => {
  const profileId = req.params.id;
  const query = "SELECT * FROM user_profiles WHERE id = ?";

  dbConnection.query(query, [profileId], (err, results) => {
    if (err) {
      console.error("프로필 조회 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "프로필을 찾을 수 없습니다" });
    }
    res.json({ profile: results[0] });
  });
});

// Gemini Lambda 호출 헬퍼 함수
async function callGeminiLambda(requestType, profile, workoutLogs = [], message = "") {
  const lambdaUrl = process.env.GEMINI_LAMBDA_URL;
  if (!lambdaUrl) {
    const err = new Error("GEMINI_LAMBDA_URL이 설정되지 않았습니다");
    err.statusCode = 503;
    throw err;
  }

  const payload = { requestType, profile, workoutLogs };
  if (message) payload.message = message;

  const response = await axios.post(lambdaUrl, payload);

  let data = response.data;
  if (typeof data === "string") {
    data = JSON.parse(data);
  }
  return data;
}

// POST /profiles/:id/routine - 운동 루틴 생성
app.post("/profiles/:id/routine", checkDbConnection, (req, res) => {
  const profileId = req.params.id;
  const query = "SELECT * FROM user_profiles WHERE id = ?";

  dbConnection.query(query, [profileId], async (err, results) => {
    if (err) {
      console.error("프로필 조회 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "프로필을 찾을 수 없습니다" });
    }

    const profile = results[0];

    try {
      const lambdaResponse = await callGeminiLambda("routine", profile);
      const routineData = lambdaResponse.body || lambdaResponse;
      let parsedRoutine = routineData;
      if (typeof routineData === "string") {
        parsedRoutine = JSON.parse(routineData);
      }

      const insertQuery =
        "INSERT INTO workout_routines (profile_id, routine_data) VALUES (?, ?)";
      dbConnection.query(
        insertQuery,
        [profileId, JSON.stringify(parsedRoutine)],
        (insertErr, insertResult) => {
          if (insertErr) {
            console.error("루틴 저장 실패:", insertErr);
            return res.status(500).json({ error: "데이터 처리 실패" });
          }
          res.status(201).json({ routine: parsedRoutine });
        }
      );
    } catch (error) {
      console.error("Lambda 호출 실패:", error);
      if (error.statusCode === 503) {
        return res.status(503).json({
          error: "AI 서비스 사용 불가",
          message: "Gemini Lambda URL이 설정되지 않았습니다. 관리자에게 문의하세요.",
        });
      }
      res.status(500).json({
        error: "AI 서비스 처리 실패",
        message: "잠시 후 다시 시도해주세요",
      });
    }
  });
});

// GET /profiles/:id/routine - 최신 운동 루틴 조회
app.get("/profiles/:id/routine", checkDbConnection, (req, res) => {
  const profileId = req.params.id;
  const query =
    "SELECT * FROM workout_routines WHERE profile_id = ? ORDER BY created_at DESC LIMIT 1";

  dbConnection.query(query, [profileId], (err, results) => {
    if (err) {
      console.error("루틴 조회 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "운동 루틴을 찾을 수 없습니다" });
    }
    res.json({ routine: results[0] });
  });
});

// POST /profiles/:id/meal - 식단 추천
app.post("/profiles/:id/meal", checkDbConnection, (req, res) => {
  const profileId = req.params.id;
  const query = "SELECT * FROM user_profiles WHERE id = ?";

  dbConnection.query(query, [profileId], async (err, results) => {
    if (err) {
      console.error("프로필 조회 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "프로필을 찾을 수 없습니다" });
    }

    const profile = results[0];

    try {
      const lambdaResponse = await callGeminiLambda("meal", profile);
      const mealData = lambdaResponse.body || lambdaResponse;
      let parsedMeal = mealData;
      if (typeof mealData === "string") {
        parsedMeal = JSON.parse(mealData);
      }

      const totalCalories = parsedMeal.targetCalories || null;
      const insertQuery =
        "INSERT INTO meal_plans (profile_id, meal_data, total_calories) VALUES (?, ?, ?)";
      dbConnection.query(
        insertQuery,
        [profileId, JSON.stringify(parsedMeal), totalCalories],
        (insertErr, insertResult) => {
          if (insertErr) {
            console.error("식단 저장 실패:", insertErr);
            return res.status(500).json({ error: "데이터 처리 실패" });
          }
          res.status(201).json({ mealPlan: parsedMeal });
        }
      );
    } catch (error) {
      console.error("Lambda 호출 실패:", error);
      if (error.statusCode === 503) {
        return res.status(503).json({
          error: "AI 서비스 사용 불가",
          message: "Gemini Lambda URL이 설정되지 않았습니다. 관리자에게 문의하세요.",
        });
      }
      res.status(500).json({
        error: "AI 서비스 처리 실패",
        message: "잠시 후 다시 시도해주세요",
      });
    }
  });
});

// GET /profiles/:id/meal - 최신 식단 조회
app.get("/profiles/:id/meal", checkDbConnection, (req, res) => {
  const profileId = req.params.id;
  const query =
    "SELECT * FROM meal_plans WHERE profile_id = ? ORDER BY created_at DESC LIMIT 1";

  dbConnection.query(query, [profileId], (err, results) => {
    if (err) {
      console.error("식단 조회 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "식단을 찾을 수 없습니다" });
    }
    res.json({ mealPlan: results[0] });
  });
});

// POST /profiles/:id/feedback - AI 피드백 요청
app.post("/profiles/:id/feedback", checkDbConnection, (req, res) => {
  const profileId = req.params.id;
  const profileQuery = "SELECT * FROM user_profiles WHERE id = ?";

  dbConnection.query(profileQuery, [profileId], async (err, profileResults) => {
    if (err) {
      console.error("프로필 조회 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    if (profileResults.length === 0) {
      return res.status(404).json({ error: "프로필을 찾을 수 없습니다" });
    }

    const profile = profileResults[0];
    const logsQuery =
      "SELECT * FROM workout_logs WHERE profile_id = ? ORDER BY log_date DESC";

    dbConnection.query(logsQuery, [profileId], async (logsErr, logsResults) => {
      if (logsErr) {
        console.error("운동 기록 조회 실패:", logsErr);
        return res.status(500).json({ error: "데이터 처리 실패" });
      }

      try {
        const lambdaResponse = await callGeminiLambda(
          "feedback",
          profile,
          logsResults
        );
        const feedbackData = lambdaResponse.body || lambdaResponse;
        let parsedFeedback = feedbackData;
        if (typeof feedbackData === "string") {
          parsedFeedback = JSON.parse(feedbackData);
        }

        res.json({ feedback: parsedFeedback });
      } catch (error) {
        console.error("Lambda 호출 실패:", error);
        if (error.statusCode === 503) {
          return res.status(503).json({
            error: "AI 서비스 사용 불가",
            message: "Gemini Lambda URL이 설정되지 않았습니다. 관리자에게 문의하세요.",
          });
        }
        res.status(500).json({
          error: "AI 서비스 처리 실패",
          message: "잠시 후 다시 시도해주세요",
        });
      }
    });
  });
});

// POST /profiles/:id/logs - 운동 기록 저장
app.post("/profiles/:id/logs", checkDbConnection, (req, res) => {
  const profileId = req.params.id;

  const validation = validateWorkoutLog(req.body);
  if (!validation.valid) {
    return res.status(400).json({ error: "유효성 검증 실패", fields: validation.errors });
  }

  const { date, completed, note } = req.body;
  const query = `
    INSERT INTO workout_logs (profile_id, log_date, completed, note)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE completed = VALUES(completed), note = VALUES(note), updated_at = CURRENT_TIMESTAMP
  `;

  dbConnection.query(query, [profileId, date, completed, note || null], (err, result) => {
    if (err) {
      console.error("운동 기록 저장 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    res.status(201).json({ message: "운동 기록이 저장되었습니다" });
  });
});

// GET /profiles/:id/logs - 운동 기록 목록 조회
app.get("/profiles/:id/logs", checkDbConnection, (req, res) => {
  const profileId = req.params.id;
  const query =
    "SELECT * FROM workout_logs WHERE profile_id = ? ORDER BY log_date DESC";

  dbConnection.query(query, [profileId], (err, results) => {
    if (err) {
      console.error("운동 기록 조회 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    res.json(results);
  });
});

// POST /profiles/:id/chat - AI 챗봇
app.post("/profiles/:id/chat", checkDbConnection, (req, res) => {
  const profileId = req.params.id;
  const { message } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "메시지를 입력해주세요" });
  }

  const query = "SELECT * FROM user_profiles WHERE id = ?";
  dbConnection.query(query, [profileId], async (err, results) => {
    if (err) {
      console.error("프로필 조회 실패:", err);
      return res.status(500).json({ error: "데이터 처리 실패" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "프로필을 찾을 수 없습니다" });
    }

    const profile = results[0];

    try {
      const lambdaResponse = await callGeminiLambda("chat", profile, [], message);
      const chatData = lambdaResponse.body || lambdaResponse;
      let parsed = chatData;
      if (typeof chatData === "string") {
        try { parsed = JSON.parse(chatData); } catch (e) { parsed = { reply: chatData }; }
      }
      res.json({ reply: parsed.reply || parsed });
    } catch (error) {
      console.error("Lambda 호출 실패:", error);
      if (error.statusCode === 503) {
        return res.status(503).json({ error: "AI 서비스 사용 불가" });
      }
      res.status(500).json({ error: "AI 서비스 처리 실패", message: "잠시 후 다시 시도해주세요" });
    }
  });
});

// 예상치 못한 에러 처리
process.on("uncaughtException", (error) => {
  console.error("처리되지 않은 에러:", error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("처리되지 않은 Promise 거부:", error);
  process.exit(1);
});

// 서버 시작
const startServer = async () => {
  try {
    await connectToDatabase();

    app.listen(port, () => {
      console.log("\n=== 서버 상태 ===");
      console.log(`포트: ${port}`);
      console.log(
        `Gemini Lambda URL: ${
          process.env.GEMINI_LAMBDA_URL ? "설정됨 ✅" : "설정 안됨 ⚠️"
        }`,
      );
      if (!process.env.GEMINI_LAMBDA_URL) {
        console.log(
          "※ Lambda URL이 설정되지 않은 AI 기능은 사용할 수 없습니다.",
        );
      }
      console.log("=================\n");
    });
  } catch (error) {
    console.error("서버 시작 실패:", error);
    process.exit(1);
  }
};

startServer();
