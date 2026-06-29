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
        .select("*")
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
    const { data, error } = await this.client
      .from("categories")
      .upsert(cat, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteCategory(id) {
    if (!this.ready) return this._localDelete("cafe_categories", id);
    const { error } = await this.client
      .from("categories")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async fetchProducts() {
    if (!this.ready)
      return Utils.getStorage("cafe_products", DEFAULT_PRODUCTS);
    try {
      const { data, error } = await this.client
        .from("products")
        .select("*")
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
    const { data, error } = await this.client
      .from("products")
      .upsert(product, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProduct(id) {
    if (!this.ready) return this._localDelete("cafe_products", id);
    const { error } = await this.client
      .from("products")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async fetchCafeInfo() {
    if (!this.ready) return Utils.getStorage("cafe_info", DEFAULT_CAFE_INFO);
    try {
      const { data, error } = await this.client
        .from("cafe_info")
        .select("*")
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
    const { data, error } = await this.client
      .from("cafe_info")
      .upsert(info, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadImage(file) {
    if (!this.ready) return null;
    const ext = file.name.split(".").pop();
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
    const record = {
      ...feedback,
      id: Utils.generateId(),
      created_at: new Date().toISOString(),
    };
    if (!this.ready) {
      this._localSave("cafe_feedbacks", record);
      return record;
    }
    try {
      const { data, error } = await this.client
        .from("feedbacks")
        .insert(feedback)
        .select()
        .single();
      if (error) throw error;
      this.cleanOldFeedbacks();
      return data;
    } catch (e) {
      console.warn("Supabase submit feedback failed, saving locally:", e);
      this._localSave("cafe_feedbacks", record);
      return record;
    }
  },

  async cleanOldFeedbacks() {
    const cutoff = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    // Clean from Supabase
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
    // Clean from localStorage
    const local = Utils.getStorage("cafe_feedbacks", []);
    const filtered = local.filter((f) => f.created_at >= cutoff);
    if (filtered.length !== local.length) {
      Utils.setStorage("cafe_feedbacks", filtered);
    }
  },

  async fetchFeedbacks() {
    // Always run cleanup first to purge expired feedbacks
    await this.cleanOldFeedbacks();
    if (!this.ready) return Utils.getStorage("cafe_feedbacks", []);
    try {
      // Only fetch feedbacks from the last 7 days
      const cutoff = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      const { data, error } = await this.client
        .from("feedbacks")
        .select("*")
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
    const { error } = await this.client
      .from("feedbacks")
      .delete()
      .eq("id", id);
    if (error) throw error;
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
