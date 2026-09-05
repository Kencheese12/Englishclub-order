// ==========================================================
// 屋台注文システム 共通処理
// 注文画面(order.html)と厨房画面(kitchen.html)の両方から
// このファイルを読み込んで使います。
// ==========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  remove,
  onValue,
  query,
  orderByChild,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 商品一覧(注文ボタンに表示される名前)
// 商品を変えたいときは、ここの文字列を書き換えるだけでOKです
export const PRODUCTS = [
  "からあげ",
  "やきそば",
  "たこ焼き",
  "フランクフルト",
  "かき氷",
  "ジュース"
];

/**
 * 注文を1件追加する
 * @param {string} name 商品名
 */
export function addOrder(name) {
  const newOrderRef = push(ref(db, "orders"));
  set(newOrderRef, {
    name: name,
    time: Date.now()
  }).catch((error) => {
    console.error("注文の追加に失敗しました:", error);
    alert("注文の追加に失敗しました。通信状況を確認してください。");
  });
}

/**
 * 注文を1件、Firebaseから削除する(内部用)
 * @param {string} id 削除する注文のid
 */
function removeOrderFromList(id) {
  return remove(ref(db, "orders/" + id));
}

/**
 * 注文を1件取り消す(注文画面用)。完成数のカウントは増えない。
 * @param {string} id 取り消す注文のid
 */
export function cancelOrder(id) {
  removeOrderFromList(id).catch((error) => {
    console.error("注文の取り消しに失敗しました:", error);
    alert("取り消しに失敗しました。通信状況を確認してください。");
  });
}

/**
 * 注文を1件完成させる(厨房画面用)。注文を削除し、完成数のカウントを1増やす。
 * @param {string} id 完成させる注文のid
 */
export function completeOrder(id) {
  removeOrderFromList(id)
    .then(() => incrementCompletedCount())
    .catch((error) => {
      console.error("完成処理に失敗しました:", error);
      alert("処理に失敗しました。通信状況を確認してください。");
    });
}

/**
 * 完成数カウントを1増やす(内部用)。runTransactionを使うことで、
 * 同時に押されても数え間違いが起きないようにしている。
 */
function incrementCompletedCount() {
  const countRef = ref(db, "completedCount");
  runTransaction(countRef, (currentValue) => (currentValue || 0) + 1).catch((error) => {
    console.error("カウントの更新に失敗しました:", error);
  });
}

/**
 * 完成数カウントの変化を監視する。データが変わるたびにcallbackが呼ばれる。
 * @param {(count: number) => void} callback
 */
export function watchCompletedCount(callback) {
  const countRef = ref(db, "completedCount");
  onValue(countRef, (snapshot) => {
    callback(snapshot.val() || 0);
  });
}

/**
 * 注文一覧の変化を監視する。データが変わるたびに、
 * 古い順に並んだ配列でcallbackが呼ばれる。
 * @param {(orders: {id: string, name: string, time: number}[]) => void} callback
 */
export function watchOrders(callback) {
  const ordersQuery = query(ref(db, "orders"), orderByChild("time"));
  onValue(
    ordersQuery,
    (snapshot) => {
      const orders = [];
      snapshot.forEach((child) => {
        const val = child.val();
        orders.push({
          id: child.key,
          name: val.name,
          time: val.time
        });
      });
      callback(orders);
    },
    (error) => {
      console.error("Firebaseからの読み込みに失敗しました:", error);
    }
  );
}

/**
 * 注文カードの一覧をHTMLに描画する共通関数。
 * 注文画面・厨房画面のどちらもこの関数を使うため、同じ見た目のカードが並ぶ。
 * カード自体をタップすると onButtonClick が呼ばれる。
 * @param {HTMLElement} container カードを入れる要素
 * @param {{id: string, name: string, time: number}[]} orders 注文一覧(古い順)
 * @param {string} buttonLabel カードに表示するボタン文字("取り消し" / "完成" など)
 * @param {(id: string) => void} onButtonClick カードをタップしたときの処理
 */
export function renderOrders(container, orders, buttonLabel, onButtonClick) {
  container.innerHTML = "";

  if (orders.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = "現在、注文はありません";
    container.appendChild(empty);
    return;
  }

  orders.forEach((order, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "order-card";
    if (index === 0) {
      card.classList.add("order-card-oldest");
    }
    card.addEventListener("click", () => onButtonClick(order.id));

    const numberEl = document.createElement("div");
    numberEl.className = "order-card-number";
    numberEl.textContent = "#" + (index + 1);
    card.appendChild(numberEl);

    const nameEl = document.createElement("div");
    nameEl.className = "order-card-name";
    nameEl.textContent = order.name;
    card.appendChild(nameEl);

    const timeEl = document.createElement("div");
    timeEl.className = "order-card-time";
    const d = new Date(order.time);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    timeEl.textContent = hh + ":" + mm;
    card.appendChild(timeEl);

    const labelEl = document.createElement("div");
    labelEl.className = "order-card-button-label";
    labelEl.textContent = buttonLabel;
    card.appendChild(labelEl);

    container.appendChild(card);
  });
}
