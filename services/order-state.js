const { ORDER_STATUS, ROLE } = require("./constants");

const STATUS_COPY = {
  [ORDER_STATUS.SUBMITTED]: {
    [ROLE.CAT]: "咪的小愿望已经交给主人啦",
    [ROLE.OWNER]: "咪点好啦，等主人看一下",
  },
  [ORDER_STATUS.REPLACEMENT_REQUESTED]: {
    [ROLE.CAT]: "主人想换一道，咪看一下",
    [ROLE.OWNER]: "等咪确认替换",
  },
  [ORDER_STATUS.ACCEPTED]: {
    [ROLE.CAT]: "主人收到啦，咪等一下",
    [ROLE.OWNER]: "已接单，准备安排",
  },
  [ORDER_STATUS.COOKING]: {
    [ROLE.CAT]: "主人开火啦，咪可以期待一下",
    [ROLE.OWNER]: "正在做，别让咪等太久",
  },
  [ORDER_STATUS.COMPLETED]: {
    [ROLE.CAT]: "可以吃啦，咪快来",
    [ROLE.OWNER]: "已完成，叫咪来吃",
  },
  [ORDER_STATUS.CANCELLED]: {
    [ROLE.CAT]: "这单先不吃啦",
    [ROLE.OWNER]: "订单已取消",
  },
};

const ACTIVE_CANCEL_STATUSES = new Set([
  ORDER_STATUS.SUBMITTED,
  ORDER_STATUS.REPLACEMENT_REQUESTED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.COOKING,
]);

function canCancelOrder(order) {
  return Boolean(order && ACTIVE_CANCEL_STATUSES.has(order.status));
}

function getNextOrderStatus(input) {
  assertTransition(input);

  const { action, currentStatus } = input;
  if (action === "request_replacement") return ORDER_STATUS.REPLACEMENT_REQUESTED;
  if (action === "confirm_replacement") return ORDER_STATUS.REPLACEMENT_REQUESTED;
  if (action === "reject_replacement") return ORDER_STATUS.CANCELLED;
  if (action === "accept") return ORDER_STATUS.ACCEPTED;
  if (action === "start_cooking") return ORDER_STATUS.COOKING;
  if (action === "complete") return ORDER_STATUS.COMPLETED;
  if (action === "cancel") return ORDER_STATUS.CANCELLED;

  return currentStatus;
}

function assertTransition({ currentStatus, action, actorRole, hasPendingReplacement = false }) {
  if (["request_replacement", "accept", "start_cooking", "complete"].includes(action)) {
    assertOwner(actorRole);
  }
  if (["confirm_replacement", "reject_replacement"].includes(action)) {
    assertCat(actorRole);
  }

  const allowed = {
    [ORDER_STATUS.SUBMITTED]: ["request_replacement", "accept", "cancel"],
    [ORDER_STATUS.REPLACEMENT_REQUESTED]: ["confirm_replacement", "reject_replacement", "accept", "cancel"],
    [ORDER_STATUS.ACCEPTED]: ["start_cooking", "cancel"],
    [ORDER_STATUS.COOKING]: ["complete", "cancel"],
    [ORDER_STATUS.COMPLETED]: [],
    [ORDER_STATUS.CANCELLED]: [],
  };

  if (!allowed[currentStatus] || !allowed[currentStatus].includes(action)) {
    throw new Error("当前订单状态不能执行该操作");
  }

  if (action === "accept" && hasPendingReplacement) {
    throw new Error("替换还没有得到咪确认");
  }
}

function getStatusCopy(status, role) {
  return STATUS_COPY[status][role];
}

function buildOrderEvent({ type, actorRole, note = "", now = new Date() }) {
  return {
    id: `evt_${now.getTime()}`,
    type,
    actorRole,
    note,
    createdAt: now.toISOString(),
  };
}

function assertOwner(role) {
  if (role !== ROLE.OWNER) {
    throw new Error("只有主人可以执行这个操作");
  }
}

function assertCat(role) {
  if (role !== ROLE.CAT) {
    throw new Error("只有咪可以执行这个操作");
  }
}

module.exports = {
  assertTransition,
  buildOrderEvent,
  canCancelOrder,
  getNextOrderStatus,
  getStatusCopy,
};
