"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "../../../lib/supabase/browser";

type ProductRow = {
  id: number;
  name: string;
  stock_qty: number;
  price_cop: number;
  active: boolean;
};

type CartItem = {
  product: ProductRow;
  quantity: number;
};

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminVentasPOSPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [payMethod, setPayMethod] = useState<"efectivo" | "tarjeta">("efectivo");

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock_qty, price_cop, active")
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) setError(error.message);
    setProducts((data ?? []) as ProductRow[]);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const addToCart = (product: ProductRow) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_qty) return prev;
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSuccess(null);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock_qty) return item;
          return { ...item, quantity: newQty };
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSuccess(null);
  };

  const subtotal = cart.reduce(
    (acc, item) => acc + item.product.price_cop * item.quantity,
    0
  );

  const total = subtotal;

  async function finalizeSale() {
    setError(null);
    setSuccess(null);

    if (cart.length === 0) {
      setError("El carrito está vacío.");
      return;
    }

    setIsSaving(true);
    const items = cart.map((item) => ({
      product_id: item.product.id,
      qty: item.quantity,
    }));

    const { data, error } = await supabase.rpc("create_sale", { items });
    setIsSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSuccess(`Venta #${data} completada por ${formatCOP(total)} — Método: ${payMethod === "efectivo" ? "Efectivo" : "Tarjeta"}`);
    setCart([]);
    await loadProducts();
  }

  function getStockBadge(stock: number) {
    if (stock <= 5) {
      return (
        <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[11px] font-semibold">
          Stock: {stock} (Bajo)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-[11px] font-semibold">
        Stock: {stock}
      </span>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 -mx-4 md:-mx-10 -my-12 min-h-[calc(100vh-220px)]">
      {/* Left Column: Product Catalog */}
      <div className="flex-1 flex flex-col p-6 lg:p-8 overflow-hidden">
        <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">point_of_sale</span>
              Punto de Venta
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">Snack Bar &amp; Hidratación</p>
          </div>
          <div className="relative w-full sm:w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xl">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-full border border-outline-variant bg-surface-container focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-sm"
              placeholder="Buscar producto..."
            />
          </div>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-600">check_circle</span>
            {success}
          </div>
        )}

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center opacity-50">
              <span className="material-symbols-outlined text-5xl mb-3">inventory_2</span>
              <p className="text-sm text-on-surface-variant">No se encontraron productos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="group bg-white rounded-xl border border-outline-variant/50 p-4 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer active:scale-95"
                >
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-container mb-3 flex items-center justify-center">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 group-hover:text-primary/50 transition-colors">
                      {product.name.toLowerCase().includes("agua") || product.name.toLowerCase().includes("gatorade") || product.name.toLowerCase().includes("coca") || product.name.toLowerCase().includes("bebida") || product.name.toLowerCase().includes("jugo")
                        ? "local_cafe"
                        : product.name.toLowerCase().includes("papa") || product.name.toLowerCase().includes("snack") || product.name.toLowerCase().includes("barra")
                        ? "lunch_dining"
                        : product.name.toLowerCase().includes("media") || product.name.toLowerCase().includes("accesorio") || product.name.toLowerCase().includes("balon")
                        ? "sports_soccer"
                        : "shopping_bag"}
                    </span>
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-bold text-primary shadow-sm">
                      {formatCOP(product.price_cop)}
                    </div>
                  </div>
                  <h3 className="font-semibold text-sm text-on-surface truncate">{product.name}</h3>
                  <div className="flex justify-between items-center mt-2">
                    {getStockBadge(product.stock_qty)}
                    <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity text-xl">
                      add_shopping_cart
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Shopping Cart Sidebar */}
      <aside className="w-full lg:w-[380px] bg-white border-l border-outline-variant/50 flex flex-col shadow-xl lg:shadow-none">
        <div className="p-5 border-b border-outline-variant/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">shopping_basket</span>
            <h2 className="font-bold text-on-surface">Carrito Actual</h2>
            {cart.length > 0 && (
              <span className="bg-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                {cart.reduce((a, i) => a + i.quantity, 0)}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-red-600 text-sm font-semibold hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-40 py-12">
              <span className="material-symbols-outlined text-6xl mb-4">inventory_2</span>
              <p className="text-sm">
                El carrito está vacío.
                <br />
                Selecciona productos para comenzar.
              </p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-container-highest/30 border border-outline-variant/30 transition-all hover:bg-white"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.product.name}</p>
                  <p className="text-[12px] text-on-surface-variant">
                    {formatCOP(item.product.price_cop)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-surface-container rounded-full px-1.5 py-1">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="material-symbols-outlined text-[18px] hover:text-primary transition-colors w-6 h-6 flex items-center justify-center"
                    >
                      remove
                    </button>
                    <span className="mx-2 font-bold text-sm min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="material-symbols-outlined text-[18px] hover:text-primary transition-colors w-6 h-6 flex items-center justify-center"
                    >
                      add
                    </button>
                  </div>
                  <p className="font-bold text-sm w-20 text-right">
                    {formatCOP(item.product.price_cop * item.quantity)}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="material-symbols-outlined text-[18px] text-red-400 hover:text-red-600 transition-colors"
                  >
                    close
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Section */}
        <div className="p-5 bg-surface-container-low border-t border-outline-variant/50">
          <div className="space-y-2 mb-5">
            <div className="flex justify-between text-sm text-on-surface-variant">
              <span>Subtotal</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-on-surface-variant">
              <span>Impuestos (0%)</span>
              <span>$0</span>
            </div>
            <div className="pt-2 border-t border-outline-variant/50 flex justify-between items-center">
              <span className="font-bold text-on-surface">Total</span>
              <span className="text-2xl font-black text-primary">{formatCOP(total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setPayMethod("efectivo")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-colors ${
                payMethod === "efectivo"
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant/50 bg-white hover:bg-surface-container"
              }`}
            >
              <span className={`material-symbols-outlined mb-1 ${payMethod === "efectivo" ? "text-primary" : "text-outline"}`}>
                payments
              </span>
              <span className={`text-xs font-semibold ${payMethod === "efectivo" ? "text-primary" : ""}`}>
                Efectivo
              </span>
            </button>
            <button
              onClick={() => setPayMethod("tarjeta")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-colors ${
                payMethod === "tarjeta"
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant/50 bg-white hover:bg-surface-container"
              }`}
            >
              <span className={`material-symbols-outlined mb-1 ${payMethod === "tarjeta" ? "text-primary" : "text-outline"}`}>
                credit_card
              </span>
              <span className={`text-xs font-semibold ${payMethod === "tarjeta" ? "text-primary" : ""}`}>
                Tarjeta
              </span>
            </button>
          </div>

          <button
            onClick={finalizeSale}
            disabled={cart.length === 0 || isSaving}
            className="w-full py-4 rounded-xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:scale-100 transition-all"
          >
            {isSaving ? "Procesando..." : "Finalizar Venta"}
          </button>
        </div>
      </aside>
    </div>
  );
}
