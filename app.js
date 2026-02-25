"use strict";

const STORAGE_KEY = "inventory-items-v1";

const LIMITS = {
    name: 80,
    sku: 30,
    category: 40,
};

const STATUS = {
    all: "all",
    ok: "ok",
    low: "low",
};

const state = {
    items: [],
    editingId: null,
    filters: {
        search: "",
        status: STATUS.all,
    },
};

const elements = {
    form: document.getElementById("inventory-form"),
    formTitle: document.getElementById("form-title"),
    submitButton: document.getElementById("submit-button"),
    cancelEdit: document.getElementById("cancel-edit"),
    formHint: document.getElementById("form-hint"),
    formError: document.getElementById("form-error"),
    name: document.getElementById("name"),
    sku: document.getElementById("sku"),
    category: document.getElementById("category"),
    quantity: document.getElementById("quantity"),
    minStock: document.getElementById("minStock"),
    price: document.getElementById("price"),
    inventoryBody: document.getElementById("inventory-body"),
    inventoryFeedback: document.getElementById("inventory-feedback"),
    search: document.getElementById("search"),
    statusFilter: document.getElementById("status-filter"),
    statProducts: document.getElementById("stat-products"),
    statUnits: document.getElementById("stat-units"),
    statLow: document.getElementById("stat-low"),
    statValue: document.getElementById("stat-value"),
    currentDate: document.getElementById("current-date"),
    dailyNote: document.getElementById("daily-note"),
};

function init(){
    if(!isDomReady()){
        console.error("No se puedo inicializar: faltan elementos del DOM.");
        return;
    }

    loadItems();
    bindEvents();
    setCurrentDate();
    sentDailyNote();
    render();
}

function isDomReady(){
    return Object.values(elements).every(Boolean);
}

function bindEvents(){
    elements.form.addEventListener("submit", handleSubmit);
    elements.cancelEdit.addEventListener("click", () => resetForm({clearHint: true}));
    elements.inventoryBody.addEventListener("click", handleTableClick);
    elements.search.addEventListener("input", handleSearch);
    elements.statusFilter.addEventListener("change", handleStatusFilter);
}

function setCurrentDate(){
    elements.currentDate.textContent = new Intl.DateTimeFormat("es-MX",{
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date());
}

function setDailyNote(){
    const notesByDay = [
        "Revisa primero los productos con menor rotación.",
        "Valida SKUs antes de cerrar movimientos del dia.",
        "Si hay stock bajo, programa reposición temprana.",
        "Compara inventario fisico con inventario registrado",
        "Prioriza productos criticos para operación diaria.",
        "Ajusta el stock minimo segun demanda real.",
        "Haz respaldo periodico de tu inventario.",
    ];

    elements.dailyNote.textContent = notesByDay[new Date().getDay()];
}

function loadItems(){
    const raw = localStorage.getItem("STORAGE_KEY");
    if(!raw){
        state.items = [];
        return;
    }

    try{
        const parsed = JSON.parse(raw);
        state.items = sanitizeLoadedItems(parsed);
    }catch (error){
        console.error("Error al leer los datos guardados:", error);
    state.items = [];
    }
}

function sanitizeLoadedItems(value){
    if(!Array.isArray(value)){
        return [];
    }

    return value
    .map((item) =>({
        id: String(item.id ?? createId()),
        name: normalizeText(item.name).slice(0, LIMITS.name),
        sku: normalizeText(item.sku).toUpperCase().slice(0, LIMITS.sku),
        category: normalizeText(item.category).slice(0, LIMITS.category),
        quantity: sanitizeInteger(item.quantity),
        minStock: sanitizeInteger(item.minStock),
        price: sanitizePrice(item.price),
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now(),
    }))
    .filter((item) => item.name && item.sku && item.category);
}

function saveItems(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function handleSubmit(event){
    event.preventDefault();
    clearError();

    const payload = getFormPayload();
    const validationError = validatePayload(payload);
    if(validationError){
        showError(validationError);
        return;
    }

    if(isDuplicatedSku(payload.sku, state.editingId)){
        showError("El SKU ya existe. Usa un valor diferente");
        return;
    }

    const wasEditing = Boolean(state.editingId);
    if(wasEditing){
        updateItem(payload);
    }else{
        createItem(payload);
    }

    saveItems();
    render();
    resetForm({clearHint: false});
    showHinte(wasEditing ? "Producto actualizado correctamente." : "Producto registrado correctamente.");
}

function getFormPayload(){
    return{
        name: normalizeText(elements.name.value),
        sku: normalizeText(elements.sku.value).toUpperCase(),
        category: normalizeText(elements.category.value), 
        quantity: Number(elements.quantity.value),
        minStock: Number(elements.minStock.value),
        price: Number(elements.price.value),
    };
}

function validatePayload(payload) {
    if (!payload.name || !payload.sku || !payload.category) {
      return "Completa todos los campos requeridos.";
    }
  
    if (payload.name.length > LIMITS.name) {
      return `El nombre no puede exceder ${LIMITS.name} caracteres.`;
    }
  
    if (payload.sku.length > LIMITS.sku) {
      return `El SKU no puede exceder ${LIMITS.sku} caracteres.`;
    }
  
    if (payload.category.length > LIMITS.category) {
      return `La categoria no puede exceder ${LIMITS.category} caracteres.`;
    }
  
    if ([payload.quantity, payload.minStock, payload.price].some((value) => Number.isNaN(value))) {
      return "Cantidad, stock minimo y precio deben ser valores numericos.";
    }
  
    if (!Number.isInteger(payload.quantity) || !Number.isInteger(payload.minStock)) {
      return "Cantidad y stock minimo deben ser numeros enteros.";
    }
  
    if (payload.quantity < 0 || payload.minStock < 0 || payload.price < 0) {
      return "No se permiten valores negativos.";
    }
  
    return "";
  }

  function isDuplicatedSku(sku, editingId = null){
    return state.items.some((item) => item.sku === sku && item.id !== editingId);
  }

  function createItem(payload){
    const now = Date.now();
    state.items.push({
        id: createId();
        ...payload,
        createdAt: now,
        updatedAt: now,
    });
  }

  function updateItem(payload){
    const index = state.items.findIndex((item) => item.id === state.editingId);
    if(index === -1){
        return;
    }

    state.items[index] = {
        ...state.items[index],
        ...payload,
        updatedAt: Date.now()
    };
  }

  function createId(){
    if(window.crypto && typeof window.crypto.randomUUID === "function"){
        return window.crypto.randowmUUID();
    }

    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function resetForm(options = {clearHint: true}){
    state.editingId = null;
    elements.form.reset();
    clearError();

    if(options.clearHint !== false){
        clearHint();
    }

    elements.formTitle.textContent = "Registrar producto";
    elements.submitButton.textContent = "Guardar producto";
    elements.cancelEdit.hidde = true;
    elements.name.focus();
  }

  function handleSearch(event){
    state.filters.search = normalizeText(event.target.value).toLowerCase();
    renderTable();
  }

  function handleStatusFilter(event){
    state.filters.status = event.targe.value;;
    renderTable();
  }

  function handleTableClick(event){
    const button = event.target.closest("button[data-action]");
    if(!button){
        return;
    }

    const{action, id} = button.dataset;
    const item = state.items.find((entry) => entry.id === id);
    if(!item){
        return;
    }

    if(action === "edit"){
        startEdit(item);
        return;
    }

    if(action === "delete"){
        removeItem(id);
        return;
    }

    if(action === "increase"){
        adjustQuantity(id, 1);
        return;
    }
  }

  if(action === "decrease"){
    adjustQuantity(id, -1);
  }

 function startEditing(item){
    state.editingId = item.id;
    elements.name.value = item.name;
    elements.sku.value = item.sku;
    elements.category.value = item.category;
    elements.quantity.value = String(item.quantity);
    elements.minStock.value = String(item.minStock);
    elements.price.value = String(item.price);

    clearError();
    showHint("Modo edicion activo.");
    elements.formTitle.textContent = `Editar producto: ${item.name}`;
    elements.submitButton.textContent = "Actualizar producto";
    elements.cancelEdit.hidde = false;
    elements.name.focus();
 }

 function removeItem(id){
    const item = state.items.find((entry) => entry.id === id);
    if(!item){
        return;
    }

    const confirmed = window.confirm(`Se eliminara "${item.name}". Deseas continuar?`);
    if(!confirmed){
        return;
    }

    state.items = state.items.filter((entry) => entry.id !== id);
    saveItems();
    render();

    if(state.editingId === id){
        resetForm({clearHint: false});
    }

    showHint(`Producto "${item.name}" eliminado.`)
 }

function adjustQuantity(id, diff){
    const item = state.item.find((entry) => entry.id === id);
    if(!item){
        return;
    }

    const nextQuantity = item.quantity + diff;
    if(nextQuantity < 0){
        return;
    }

    item.quantity = nextQuantity;
    item.apdatedAt = Date.now();
    saveItems();
    render();
 }

 function getItemStatus(item){
    return item.quantity <= item.minStock ? STATUS.low : STATUS.ok;
 }

 function getFilteredItems(){
    return state.items
    .filter((item) =>{
        const query = state.filters.search;
        const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

        if(!matchesSearch){
            return false;
        }

        if(state.filters.status === STATUS.all){
            return true;
        }

        return state.filters.status === getItemStatus(item);
    })
    .sort((a,b) => a.name.localeCompare(b.name))
 }

 function render(){
    renderStat();
    renderTable();
 }

 function renderStats(){
    const totalProducts = state.items.length;
    const totalUnits = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const lowStock = state.items.filter((item) => getItemStatus(item) === STATUS.low).length;
    const totalValue = state.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    elements.statProducts.textContent = String(totalProducts);
    elements.statUnits.textContent = String(totalUnits);
    elements.statLow.textContent = String(lowStock);
    elements.statValue.textContent = formatCurrency(totalValue);

    if(totalProducts === 0){
        elements.inventoryFeedback.textContent = "Sin productos registrados";
        return;
    }

    if(lowStock > 0){
        elements.inventoryFeedback.textContent = `Hay ${lowStock} producto(s) en stock bajo.`;
        return;
    }

    elements.inventoryFeedback.textContent = "Inventario del dia.";
 }
