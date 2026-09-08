export interface Product {
  id: string;
  nameAr: string;
  descriptionAr: string;
}

/**
 * Product catalog — add or edit entries here as content becomes available.
 * Prices and payment integration will be added in a future phase.
 */
export const products: Product[] = [
  {
    id: "content-pack-01",
    nameAr: "📚 حزمة المحتوى التعليمي — المستوى الأول",
    descriptionAr: "مجموعة من الفيديوهات التعليمية التفاعلية للأطفال.",
  },
  {
    id: "content-pack-02",
    nameAr: "🎨 حزمة المحتوى التعليمي — المستوى الثاني",
    descriptionAr: "محتوى تعليمي متقدّم يشجّع على التفكير والإبداع.",
  },
  {
    id: "content-pack-03",
    nameAr: "🌟 حزمة المحتوى الشاملة",
    descriptionAr: "وصول كامل إلى جميع محتويات 3M Kids Zone.",
  },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function getAllProducts(): Product[] {
  return [...products];
}
