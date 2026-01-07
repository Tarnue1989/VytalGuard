// 📁 backend/src/utils/response.js
export const success = (res, message = "Success", data = {}) => {
  return res.json({
    success: true,
    message,
    data,
  });
};

export const error = (res, message = "Error", err = null, status = 500) => {
  return res.status(status).json({
    success: false,
    message,
    error: err?.message || err,
  });
};
