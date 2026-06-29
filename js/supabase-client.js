const SupaDB = {
  client: null,
  ready: false,

  init() {
    if (
      !window.supabase ||
      !SUPABASE_URL ||
      SUPABASE_URL.includes("YOUR_PROJECT")
    ) {
      console.warn(
        "Supabase not configured — running in offline/localStorage mode"
      );
      return false;
    }
    this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.ready = true;
    return true;
  },

  async getSession() {
    if (!this.ready) return null;
    const {
      data: { session },
    } = await this.client.auth.getSession();
    return session;
  },

  async signIn(email, password) {
    if (!this.ready) throw new Error("Supabase not configured");
    return await this.client.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    if (!this.ready) return;
    await this.client.auth.signOut();
  },

  async fetchCategories() {
    if (!this.ready)
      return Utils.getStorage("cafe_categories", DEFAULT_CATEGORIES);
    try {
      const { data, error } = await this.client
        .from("categories")
        .select("id, name_fa, icon, order, created_at")
        .order("order");
      if (error) throw error;
      Utils.setStorage("cafe_categories", data);
      return data;
    } catch (e) {
      console.warn("Supabase fetch categories failed, using cache:", e);
      return Utils.getStorage("cafe_categories", DEFAULT_CATEGORIES);
    }
  },

  async saveCategory(cat) {
    if (!this.ready) return this._localSave("cafe_categories", cat);
    const sanitized = this._sanitizeCategory(cat);
    const { data, error } = await this.client
      .from("categories")
      .upsert(sanitized, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    this._invalidateCache("cafe_categories");
    return data;
  },

  async deleteCategory(id) {
    if (!this.ready) return this._localDelete("cafe_categories", id);
    const { error } = await this.client
      .from("categories")
      .delete()
      .eq("id", id);
    if (error) throw error;
    this._invalidateCache("cafe_categories");
  },

  async fetchProducts() {
    if (!this.ready)
      return Utils.getStorage("cafe_products", DEFAULT_PRODUCTS);
    try {
      const { data, error } = await this.client
        .from("products")
        .select("id, category_id, name_fa, description_fa, price, image_url, is_featured, order, created_at")
        .order("order");
      if (error) throw error;
      Utils.setStorage("cafe_products", data);
      return data;
    } catch (e) {
      console.warn("Supabase fetch products failed, using cache:", e);
      return Utils.getStorage("cafe_products", DEFAULT_PRODUCTS);
    }
  },

  async saveProduct(product) {
    if (!this.ready) return this._localSave("cafe_products", product);
    const sanitized = this._sanitizeProduct(product);
    const { data, error } = await this.client
      .from("products")
      .upsert(sanitized, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    this._invalidateCache("cafe_products");
    return data;
  },

  async updateProduct(product, oldImageUrl) {
    if (!this.ready) return this._localSave("cafe_products", product);
    const sanitized = this._sanitizeProduct(product);
    const { data, error } = await this.client
      .from("products")
      .upsert(sanitized, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    if (oldImageUrl && oldImageUrl !== product.image_url) {
      await this._deleteStorageFile(oldImageUrl);
    }
    this._invalidateCache("cafe_products");
    return data;
  },

  async deleteProduct(id) {
    if (!this.ready) return this._localDelete("cafe_products", id);
    if (!id) throw new Error("Product ID is required");

    const { data: product, error: fetchError } = await this.client
      .from("products")
      .select("id, image_url")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;

    const imageUrl = product?.image_url;

    if (imageUrl) {
      await this._clearImageField(id);
      await this._deleteStorageFile(imageUrl);
    }

    const { error } = await this.client
      .from("products")
      .delete()
      .eq("id", id);
    if (error) throw error;
    this._invalidateCache("cafe_products");
  },

  async _clearImageField(id) {
    try {
      await this.client
        .from("products")
        .update({ image_url: null })
        .eq("id", id);
    } catch (e) {
      console.warn("Clear image field failed:", e);
    }
  },

  async _deleteStorageFile(imageUrl) {
    if (!this.ready || !imageUrl) return;
    const path = this._extractStoragePath(imageUrl);
    if (!path) return;
    try {
      await this.client.storage.from("cafe-images").remove([path]);
    } catch (e) {
      console.warn("Storage file cleanup failed:", e);
    }
  },

  _extractStoragePath(url) {
    if (!url || typeof url !== "string") return null;
    const marker = "/storage/v1/object/public/cafe-images/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  },

  async fetchCafeInfo() {
    if (!this.ready) return Utils.getStorage("cafe_info", DEFAULT_CAFE_INFO);
    try {
      const { data, error } = await this.client
        .from("cafe_info")
        .select("id, name, tagline, phone, address_fa, instagram, telegram, hours_fa, about_fa, welcome_fa, logo_url, updated_at")
        .limit(1)
        .single();
      if (error) throw error;
      Utils.setStorage("cafe_info", data);
      return data;
    } catch (e) {
      console.warn("Supabase fetch cafe_info failed, using cache:", e);
      return Utils.getStorage("cafe_info", DEFAULT_CAFE_INFO);
    }
  },

  async saveCafeInfo(info) {
    if (!this.ready) return this._localSave("cafe_info", info);
    const sanitized = {
      id: info.id || "singleton",
      name: String(info.name || "").slice(0, 200),
      tagline: String(info.tagline || "").slice(0, 500),
      phone: String(info.phone || "").slice(0, 50),
      address_fa: String(info.address_fa || "").slice(0, 500),
      instagram: String(info.instagram || "").slice(0, 100),
      telegram: String(info.telegram || "").slice(0, 100),
      hours_fa: String(info.hours_fa || "").slice(0, 200),
      about_fa: String(info.about_fa || "").slice(0, 2000),
      welcome_fa: String(info.welcome_fa || "").slice(0, 500),
      logo_url: info.logo_url || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.client
      .from("cafe_info")
      .upsert(sanitized, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    this._invalidateCache("cafe_info");
    return data;
  },

  async uploadImage(file) {
    if (!this.ready) return null;
    if (!file || !file.type || !file.type.startsWith("image/")) {
      throw new Error("فایل انتخاب شده تصویر نیست");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("حجم فایل نباید بیشتر از ۵ مگابایت باشد");
    }
    const allowedExts = ["jpg", "jpeg", "png", "webp", "gif"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      throw new Error("فرمت فایل مجاز نیست");
    }
    const fileName =
      Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    const filePath = "menu/" + fileName;

    const { error } = await this.client.storage
      .from("cafe-images")
      .upload(filePath, file, { contentType: file.type });

    if (error) throw error;

    const { data: urlData } = this.client.storage
      .from("cafe-images")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  },

  async submitFeedback(feedback) {
    const name = String(feedback.name || "ناشناس").slice(0, 100);
    const message = String(feedback.message || "").slice(0, 2000);
    if (!message.trim()) throw new Error("پیام نمی‌تواند خالی باشد");

    const record = {
      name,
      message,
    };
    if (!this.ready) {
      const localRecord = {
        ...record,
        id: Utils.generateId(),
        created_at: new Date().toISOString(),
      };
      this._localSave("cafe_feedbacks", localRecord);
      return localRecord;
    }
    try {
      const { data, error } = await this.client
        .from("feedbacks")
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      this.cleanOldFeedbacks();
      return data;
    } catch (e) {
      console.warn("Supabase submit feedback failed, saving locally:", e);
      const localRecord = {
        ...record,
        id: Utils.generateId(),
        created_at: new Date().toISOString(),
      };
      this._localSave("cafe_feedbacks", localRecord);
      return localRecord;
    }
  },

  async cleanOldFeedbacks() {
    const cutoff = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    if (this.ready) {
      try {
        await this.client
          .from("feedbacks")
          .delete()
          .lt("created_at", cutoff);
      } catch (e) {
        console.warn("Supabase cleanup old feedbacks failed:", e);
      }
    }
    const local = Utils.getStorage("cafe_feedbacks", []);
    const filtered = local.filter((f) => f.created_at >= cutoff);
    if (filtered.length !== local.length) {
      Utils.setStorage("cafe_feedbacks", filtered);
    }
  },

  async fetchFeedbacks() {
    await this.cleanOldFeedbacks();
    if (!this.ready) return Utils.getStorage("cafe_feedbacks", []);
    try {
      const cutoff = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      const { data, error } = await this.client
        .from("feedbacks")
        .select("id, name, message, created_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn("Supabase fetch feedbacks failed:", e);
      return Utils.getStorage("cafe_feedbacks", []);
    }
  },

  async deleteFeedback(id) {
    if (!this.ready) return this._localDelete("cafe_feedbacks", id);
    if (!id) throw new Error("Feedback ID is required");
    const { error } = await this.client
      .from("feedbacks")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  _sanitizeProduct(product) {
    return {
      id: String(product.id || "").slice(0, 50),
      category_id: String(product.category_id || "").slice(0, 50),
      name_fa: String(product.name_fa || "").slice(0, 200),
      description_fa: String(product.description_fa || "").slice(0, 1000),
      price: Math.max(0, Math.floor(Number(product.price) || 0)),
      image_url: product.image_url ? String(product.image_url).slice(0, 2000) : null,
      is_featured: Boolean(product.is_featured),
      order: Math.max(0, Math.floor(Number(product.order) || 0)),
    };
  },

  _sanitizeCategory(cat) {
    return {
      id: String(cat.id || "").slice(0, 50),
      name_fa: String(cat.name_fa || "").slice(0, 100),
      icon: String(cat.icon || "✦").slice(0, 10),
      order: Math.max(0, Math.floor(Number(cat.order) || 0)),
    };
  },

  _invalidateCache(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // silent
    }
  },

  _localSave(key, item) {
    const list = Utils.getStorage(key, []);
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx > -1) {
      list[idx] = item;
    } else {
      list.push(item);
    }
    Utils.setStorage(key, list);
    return item;
  },

  _localDelete(key, id) {
    const list = Utils.getStorage(key, []).filter((x) => x.id !== id);
    Utils.setStorage(key, list);
  },
};
