/**
 * 유효성 검증 함수 모듈
 */

const VALID_GOAL_TYPES = ['diet', 'bulk', 'maintain'];
const VALID_EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'];

/**
 * 사용자 프로필 데이터 유효성 검증
 * @param {object} data - 프로필 데이터
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateProfile(data) {
  const errors = [];

  if (data == null || typeof data !== 'object') {
    return { valid: false, errors: ['입력 데이터가 올바르지 않습니다'] };
  }

  // 필수 필드 존재 여부 확인
  const requiredFields = ['height', 'weight', 'goalType', 'experienceLevel', 'weeklyWorkouts'];
  const missingFields = requiredFields.filter((field) => data[field] === undefined || data[field] === null || data[field] === '');
  if (missingFields.length > 0) {
    errors.push(`필수 항목이 누락되었습니다: ${missingFields.join(', ')}`);
  }

  // height 범위 검증 (100~250)
  if (data.height !== undefined && data.height !== null && data.height !== '') {
    const height = Number(data.height);
    if (isNaN(height) || height < 100 || height > 250) {
      errors.push('키는 100cm에서 250cm 사이여야 합니다');
    }
  }

  // weight 범위 검증 (30~300)
  if (data.weight !== undefined && data.weight !== null && data.weight !== '') {
    const weight = Number(data.weight);
    if (isNaN(weight) || weight < 30 || weight > 300) {
      errors.push('몸무게는 30kg에서 300kg 사이여야 합니다');
    }
  }

  // goalType 검증
  if (data.goalType !== undefined && data.goalType !== null && data.goalType !== '') {
    if (!VALID_GOAL_TYPES.includes(data.goalType)) {
      errors.push(`목표 유형은 ${VALID_GOAL_TYPES.join(', ')} 중 하나여야 합니다`);
    }
  }

  // experienceLevel 검증
  if (data.experienceLevel !== undefined && data.experienceLevel !== null && data.experienceLevel !== '') {
    if (!VALID_EXPERIENCE_LEVELS.includes(data.experienceLevel)) {
      errors.push(`운동 경험은 ${VALID_EXPERIENCE_LEVELS.join(', ')} 중 하나여야 합니다`);
    }
  }

  // weeklyWorkouts 범위 검증 (1~7)
  if (data.weeklyWorkouts !== undefined && data.weeklyWorkouts !== null && data.weeklyWorkouts !== '') {
    const weeklyWorkouts = Number(data.weeklyWorkouts);
    if (isNaN(weeklyWorkouts) || !Number.isInteger(weeklyWorkouts) || weeklyWorkouts < 1 || weeklyWorkouts > 7) {
      errors.push('주간 운동 횟수는 1에서 7 사이의 정수여야 합니다');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 운동 기록 데이터 유효성 검증
 * @param {object} data - 운동 기록 데이터
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateWorkoutLog(data) {
  const errors = [];

  if (data == null || typeof data !== 'object') {
    return { valid: false, errors: ['입력 데이터가 올바르지 않습니다'] };
  }

  // date 필드 존재 여부 및 형식 검증
  if (data.date === undefined || data.date === null || data.date === '') {
    errors.push('날짜는 필수 항목입니다');
  } else {
    const dateStr = String(data.date);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(dateStr)) {
      errors.push('날짜는 YYYY-MM-DD 형식이어야 합니다');
    } else {
      // 실제 존재하는 날짜인지 확인
      const [year, month, day] = dateStr.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);

      if (
        dateObj.getFullYear() !== year ||
        dateObj.getMonth() !== month - 1 ||
        dateObj.getDate() !== day
      ) {
        errors.push('유효하지 않은 날짜입니다');
      }
    }
  }

  // completed 필드 boolean 타입 검증
  if (data.completed === undefined || data.completed === null) {
    errors.push('완료 여부는 필수 항목입니다');
  } else if (typeof data.completed !== 'boolean') {
    errors.push('완료 여부는 boolean 타입이어야 합니다');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateProfile, validateWorkoutLog };
