const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_FIELD: "MISSING_FIELD",
  INVALID_TYPE: "INVALID_TYPE",
  OUT_OF_RANGE: "OUT_OF_RANGE"
};

class ValidationError extends Error {
  constructor(code, message, field = null) {
    super(message);
    this.name = "ValidationError";
    this.code = code;
    this.field = field;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      field: this.field
    };
  }
}

const validators = {
  required: (value, fieldName) => {
    if (value === undefined || value === null || value === "") {
      throw new ValidationError(
        ERROR_CODES.MISSING_FIELD,
        `${fieldName} is required`,
        fieldName
      );
    }
    return value;
  },

  string: (value, fieldName, options = {}) => {
    if (typeof value !== "string") {
      throw new ValidationError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldName} must be a string`,
        fieldName
      );
    }

    const trimmed = value.trim();
    
    if (options.minLength && trimmed.length < options.minLength) {
      throw new ValidationError(
        ERROR_CODES.OUT_OF_RANGE,
        `${fieldName} must be at least ${options.minLength} characters`,
        fieldName
      );
    }

    if (options.maxLength && trimmed.length > options.maxLength) {
      throw new ValidationError(
        ERROR_CODES.OUT_OF_RANGE,
        `${fieldName} must be at most ${options.maxLength} characters`,
        fieldName
      );
    }

    if (options.pattern && !options.pattern.test(trimmed)) {
      throw new ValidationError(
        ERROR_CODES.INVALID_INPUT,
        options.patternMessage || `${fieldName} format is invalid`,
        fieldName
      );
    }

    return trimmed;
  },

  number: (value, fieldName, options = {}) => {
    const num = Number(value);
    
    if (isNaN(num)) {
      throw new ValidationError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldName} must be a number`,
        fieldName
      );
    }

    if (options.min !== undefined && num < options.min) {
      throw new ValidationError(
        ERROR_CODES.OUT_OF_RANGE,
        `${fieldName} must be at least ${options.min}`,
        fieldName
      );
    }

    if (options.max !== undefined && num > options.max) {
      throw new ValidationError(
        ERROR_CODES.OUT_OF_RANGE,
        `${fieldName} must be at most ${options.max}`,
        fieldName
      );
    }

    if (options.integer && !Number.isInteger(num)) {
      throw new ValidationError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldName} must be an integer`,
        fieldName
      );
    }

    return num;
  },

  object: (value, fieldName) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ValidationError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldName} must be an object`,
        fieldName
      );
    }
    return value;
  },

  array: (value, fieldName, options = {}) => {
    if (!Array.isArray(value)) {
      throw new ValidationError(
        ERROR_CODES.INVALID_TYPE,
        `${fieldName} must be an array`,
        fieldName
      );
    }

    if (options.minLength && value.length < options.minLength) {
      throw new ValidationError(
        ERROR_CODES.OUT_OF_RANGE,
        `${fieldName} must have at least ${options.minLength} items`,
        fieldName
      );
    }

    if (options.maxLength && value.length > options.maxLength) {
      throw new ValidationError(
        ERROR_CODES.OUT_OF_RANGE,
        `${fieldName} must have at most ${options.maxLength} items`,
        fieldName
      );
    }

    return value;
  },

  enum: (value, fieldName, allowedValues) => {
    if (!allowedValues.includes(value)) {
      throw new ValidationError(
        ERROR_CODES.INVALID_INPUT,
        `${fieldName} must be one of: ${allowedValues.join(", ")}`,
        fieldName
      );
    }
    return value;
  },

  username: (value) => {
    validators.required(value, "username");
    return validators.string(value, "username", {
      minLength: 2,
      maxLength: 20,
      pattern: /^[a-zA-Z0-9_-]+$/,
      patternMessage: "Username can only contain letters, numbers, underscores and hyphens"
    });
  },

  lobbyId: (value) => {
    validators.required(value, "lobbyId");
    return validators.string(value, "lobbyId", {
      minLength: 1,
      maxLength: 50
    });
  },

  position: (value) => {
    validators.required(value, "position");
    validators.object(value, "position");
    
    const x = validators.number(value.x, "position.x", { min: 0, max: 8, integer: true });
    const y = validators.number(value.y, "position.y", { min: 0, max: 11, integer: true });
    
    return { x, y };
  },

  corporation: (value, allowedCorps) => {
    validators.required(value, "corporation");
    return validators.enum(value, "corporation", allowedCorps);
  }
};

const validate = (schema, data) => {
  const result = {};
  const errors = [];

  for (const [field, validator] of Object.entries(schema)) {
    try {
      if (typeof validator === "function") {
        result[field] = validator(data[field]);
      } else if (typeof validator === "object") {
        const { type, ...options } = validator;
        if (validators[type]) {
          result[field] = validators[type](data[field], field, options);
        }
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(error.toJSON());
      } else {
        throw error;
      }
    }
  }

  if (errors.length > 0) {
    const combinedError = new ValidationError(
      ERROR_CODES.VALIDATION_ERROR,
      "Validation failed"
    );
    combinedError.errors = errors;
    throw combinedError;
  }

  return result;
};

module.exports = {
  ValidationError,
  validators,
  validate,
  ERROR_CODES
};
