import { siteConfig } from "@/config/site";

export function GuidePrice() {
  return (
    <>
      <span className="opacity-60 line-through">{siteConfig.guideOriginalPrice}</span>{" "}
      <span>{siteConfig.guidePrice}</span>
    </>
  );
}
