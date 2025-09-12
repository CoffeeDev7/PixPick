# PixPick

A lightweight, collaborative image-rating and curation app — built for fast sharing, quick feedback, and private boards.

> Simple. Fast. Delightful.

---

## 💡 What is PixPick?

PixPick is a minimal gallery-style app where you can paste or upload images, create boards, invite collaborators, and quickly rate/curate images. Designed for creative teams, friends, and anyone who wants to organize visual ideas without bloated features.

---

## 📸 Screenshots

<img width="1883" height="871" alt="image" src="https://github.com/user-attachments/assets/cb496ca0-ddd3-408a-a599-3f99149f2a71" />

<img width="1898" height="782" alt="image" src="https://github.com/user-attachments/assets/2c3f47f4-999c-4c01-9f72-b734952686e2" />

<img width="1893" height="868" alt="image" src="https://github.com/user-attachments/assets/c6daf33d-a624-426b-af29-c02937d28226" />


---

## 🚀 Key features

* **Boards & Collaboration**: Create boards (My Boards / Shared With Me ) and invite collaborators with roles.
* **Quick Paste + Upload**: Paste images from clipboard or drag-and-drop to add instantly.
* **Image Rating**: Rate images quickly using a simple, keyboard-friendly UI.
* **Swipeable Gallery Viewer**: Mobile-friendly modal with smooth swipe transitions and tap-to-close.
* **Real-time Updates**: See collaborator changes in real time .
* **Lightweight Storage Options**: Works with free storage alternatives (local server / free-tier object stores) — optimized to keep costs low.
* **Drag-to-Reorder (mobile long-press)**: Long-press to reorder images on mobile with smooth animations and persistent order.


---



## ✅ Why PixPick is better than its peers

* **Built for speed, not storage-heavy indexing** — focuses on fast workflows for designers and makers rather than bloated feature lists.
* **Low-cost hosting friendly** — designed to work well without expensive storage (good for hobby projects and early-stage teams).
* **Cleaner collaboration model** — uses a `collaborators` subcollection with roles, making permission logic simpler than ad-hoc shared lists.
* **Mobile-first UX for quick decisions** — long-press reordering, swipeable viewer, and tap-to-close for fast mobile curation.
* **Opinionated small feature set** — fewer choices = less friction. If peers overwhelm you with options, PixPick helps teams move faster.

---

## 🧭 Quick start (development)

1. Clone the repo

```bash
git clone https://github.com/<your-org>/pixpick.git
cd pixpick
```

2. Install dependencies

```bash
npm install
```

3. Configure environment (see `.env.example`) — set database and storage options.
4. Start the app

```bash
npm run dev
```

---

## 🤝 Contributing

* Keep changes small and focused per commit.
* Add tests for logic that affects ordering, sharing, or rating.
* For UI changes, include screenshots in `/screenshots` and update this README.

---

