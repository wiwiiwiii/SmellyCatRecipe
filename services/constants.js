const ROLE = {
  CAT: "cat",
  OWNER: "owner",
};

const MEAL_TIME = {
  LUNCH: "lunch",
  DINNER: "dinner",
  LATE_NIGHT: "late_night",
};

const MOOD = {
  HUNGRY: "hungry",
  HOT: "hot",
  MEAT: "meat",
  SWEET: "sweet",
  TIRED: "tired",
  OWNER_PICK: "owner_pick",
};

const ORDER_STATUS = {
  SUBMITTED: "submitted",
  REPLACEMENT_REQUESTED: "replacement_requested",
  ACCEPTED: "accepted",
  COOKING: "cooking",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const NOTIFICATION_TEMPLATE_KEY = {
  OWNER_NEW_ORDER: "owner_new_order",
  CAT_REPLACEMENT_REQUESTED: "cat_replacement_requested",
  CAT_ORDER_ACCEPTED: "cat_order_accepted",
  CAT_ORDER_COOKING: "cat_order_cooking",
  CAT_ORDER_COMPLETED: "cat_order_completed",
};

const MEAL_TIME_LABELS = {
  [MEAL_TIME.LUNCH]: "午饭",
  [MEAL_TIME.DINNER]: "晚饭",
  [MEAL_TIME.LATE_NIGHT]: "夜宵",
};

const MOOD_LABELS = {
  [MOOD.HUNGRY]: "饿了，要顶饱",
  [MOOD.HOT]: "想吃热乎的",
  [MOOD.MEAT]: "今天想吃肉",
  [MOOD.SWEET]: "想来点甜的",
  [MOOD.TIRED]: "有点累，想省心",
  [MOOD.OWNER_PICK]: "没主意，主人安排",
};

module.exports = {
  MEAL_TIME,
  MEAL_TIME_LABELS,
  MOOD,
  MOOD_LABELS,
  NOTIFICATION_TEMPLATE_KEY,
  ORDER_STATUS,
  ROLE,
};
