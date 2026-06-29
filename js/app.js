/**
 * app.js — Public menu page logic (Alpine.js)
 * Manages: categories, products, search, filtering, favorites panel, feedback, UI state.
 * No cart, no ordering — purely a display menu.
 */

document.addEventListener("alpine:init", () => {
  Alpine.data("cafeMenu", () => ({
    // State
    categories: [],
    products: [],
    cafeInfo: {},
    activeCategory: "cat-1",
    searchQuery: "",
    favorites: [],
    isLoaded: false,
    showMobileMenu: false,
    darkMode: false,
    showFavPanel: false,

    // Feedback state
    feedbackForm: { name: "", message: "" },
    feedbackSending: false,
    feedbackSuccess: false,
    feedbackError: "",

    // Init
    async init() {
      SupaDB.init();
      await this.loadData();
      this.loadFavorites();
      this.loadDarkMode();
      this.trackVisit();
      setTimeout(() => {
        this.isLoaded = true;
        this.$nextTick(() => this.observeFadeIns());
      }, 600);
      this.setupNavbar();
    },

    // Load data from Supabase with localStorage fallback
    async loadData() {
      this.categories = await SupaDB.fetchCategories();
      this.products = await SupaDB.fetchProducts();
      this.cafeInfo = await SupaDB.fetchCafeInfo();
      this.categories.sort((a, b) => a.order - b.order);
      this.products.sort((a, b) => a.order - b.order);
    },

    // Track site visits
    trackVisit() {
      const visits = Utils.getStorage("cafe_visit_count", 0) + 1;
      Utils.setStorage("cafe_visit_count", visits);
    },

    // Favorites
    loadFavorites() {
      this.favorites = Utils.getStorage("cafe_favorites", []);
    },

    toggleFavorite(productId) {
      const idx = this.favorites.indexOf(productId);
      if (idx > -1) {
        this.favorites.splice(idx, 1);
      } else {
        this.favorites.push(productId);
      }
      Utils.setStorage("cafe_favorites", this.favorites);
    },

    isFavorite(productId) {
      return this.favorites.includes(productId);
    },

    get favoriteProducts() {
      return this.products.filter((p) => this.favorites.includes(p.id));
    },

    get favoriteCount() {
      return this.favorites.length;
    },

    // Favorites panel
    toggleFavPanel() {
      this.showFavPanel = !this.showFavPanel;
    },

    // Dark mode
    loadDarkMode() {
      this.darkMode = Utils.getStorage("cafe_dark_mode", false);
      if (this.darkMode) {
        document.body.classList.add("dark-mode");
      }
    },

    toggleTheme() {
      this.darkMode = !this.darkMode;
      document.body.classList.toggle("dark-mode", this.darkMode);
      Utils.setStorage("cafe_dark_mode", this.darkMode);
    },

    // Filtering
    setCategory(catId) {
      this.activeCategory = catId;
    },

    get filteredProducts() {
      let list = this.products;
      if (this.activeCategory !== "cat-1") {
        list = list.filter((p) => p.category_id === this.activeCategory);
      }
      const raw = this.searchQuery;
      if (!raw || !raw.trim()) return list;
      const q = raw.trim().toLowerCase().replace(/\s+/g, " ");
      if (!q) return list;

      const scored = [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const name = (p.name_fa || "").toLowerCase();
        const desc = (p.description_fa || "").toLowerCase();
        let score = 0;
        if (name.startsWith(q)) score = 3;
        else if (this._wordMatch(name, q)) score = 2;
        else if (name.includes(q) || desc.includes(q)) score = 1;
        if (score > 0) scored.push({ p, score, order: p.order });
      }
      scored.sort((a, b) => b.score - a.score || a.order - b.order);
      return scored.map((s) => s.p);
    },

    get featuredProducts() {
      return this.products.filter((p) => p.is_featured);
    },

    // Feedback
    async submitFeedback() {
      this.feedbackError = "";
      if (!this.feedbackForm.message.trim()) {
        this.feedbackError = "لطفاً پیام خود را بنویسید.";
        return;
      }
      this.feedbackSending = true;
      try {
        await SupaDB.submitFeedback({
          name: this.feedbackForm.name.trim() || "ناشناس",
          message: this.feedbackForm.message.trim(),
        });
        this.feedbackSuccess = true;
        this.feedbackForm = { name: "", message: "" };
        setTimeout(() => (this.feedbackSuccess = false), 4000);
      } catch (e) {
        console.warn("Feedback submit failed:", e);
        this.feedbackError = "خطا در ارسال. لطفاً دوباره تلاش کنید.";
      } finally {
        this.feedbackSending = false;
      }
    },

    // Helpers
    _wordMatch(haystack, needle) {
      if (!haystack || !needle) return false;
      const words = haystack.split(/[\s،.!?،\-\/]+/);
      for (let i = 0; i < words.length; i++) {
        if (words[i] === needle) return true;
      }
      return false;
    },

    formatPrice(toman) {
      return Utils.formatPrice(toman);
    },

    toPersianNum(n) {
      return Utils.toPersianNum(n);
    },

    // Scroll-triggered fade-in via IntersectionObserver
    observeFadeIns() {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
      );

      document.querySelectorAll(".fade-in").forEach((el) => {
        observer.observe(el);
      });
    },

    // Navbar scroll effect
    setupNavbar() {
      const navbar = document.querySelector(".navbar");
      if (!navbar) return;
      window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
          navbar.classList.add("scrolled");
        } else {
          navbar.classList.remove("scrolled");
        }
      });
    },

    // Smooth scroll to section
    scrollTo(id) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      this.showMobileMenu = false;
    },
  }));
});
