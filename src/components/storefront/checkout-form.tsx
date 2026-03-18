"use client";

import { useCartStore } from "@/lib/store/cart";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createOrder } from "@/lib/actions/order";
import { Loader2, ShoppingBag, CreditCard, Banknote } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Address } from "@prisma/client";
import {
  determineVAT,
  COUNTRY_LIST,
  EU_COUNTRY_CODES,
  validateEUVATFormat,
} from "@/lib/vat";
import { formatMoney } from "@/lib/formatters";
import { convertPrice, type SupportedCurrency } from "@/lib/currency";
import { CheckoutOrderSummary } from "./CheckoutOrderSummary";

interface CheckoutFormProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    b2bStatus: string;
    taxId?: string | null;
    registrationCountry?: string | null;
  } | null;
  addresses?: Address[];
  currency?: string;
  exchangeRate?: number;
  shippingMethods?: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    estimatedDays: number | null;
    isDefault: boolean;
  }[];
}

export default function CheckoutForm({
  user,
  addresses = [],
  currency = "EUR",
  exchangeRate = 1,
  shippingMethods = [],
}: CheckoutFormProps) {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const fm = (amount: Parameters<typeof formatMoney>[0]) =>
    formatMoney(
      convertPrice(
        typeof amount === "number" ? amount : Number(amount),
        currency as SupportedCurrency,
        exchangeRate
      ),
      { locale, currency }
    );
  const { items, getTotalPrice, clearCart } = useCartStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    zipCode: "",
    country: "ES",
    phone: "",
    paymentMethod: "CECABANK",
    poNumber: "",
    vatNumber: "",
  });

  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [vatNumberError, setVatNumberError] = useState<string>("");
  const [selectedShippingMethodId, setSelectedShippingMethodId] =
    useState<string>("");

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    if (addressId === "new") {
      setFormData((prev) => ({
        ...prev,
        firstName: "",
        lastName: "",
        address: "",
        city: "",
        zipCode: "",
        phone: "",
      }));
      return;
    }

    const addr = addresses?.find((a) => a.id === addressId);
    if (addr) {
      setFormData((prev) => ({
        ...prev,
        firstName: addr.firstName,
        lastName: addr.lastName,
        address: addr.street,
        city: addr.city,
        zipCode: addr.zipCode,
        country: addr.country || "ES",
        phone: addr.phone || prev.phone,
      }));
    }
  };

  useEffect(() => {
    if (user?.name) {
      const parts = user.name.split(" ");
      setFormData((prev) => ({
        ...prev,
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!selectedShippingMethodId && shippingMethods.length > 0) {
      const preferred =
        shippingMethods.find((method) => method.isDefault) ??
        shippingMethods[0];
      setSelectedShippingMethodId(preferred.id);
    }
  }, [selectedShippingMethodId, shippingMethods]);

  const totalPrice = getTotalPrice();
  const isB2B = user?.b2bStatus === "APPROVED";
  const userRegistrationCountry = user?.registrationCountry ?? null;
  const userTaxId = user?.taxId ?? null;

  let effectiveBuyerCountry: string;
  let effectiveVatNumber: string | undefined;
  let showVatNumberInput: boolean;

  if (isB2B && userRegistrationCountry === "ES") {
    // B2B registered in Spain: always charge Spanish VAT regardless of shipping address
    effectiveBuyerCountry = "ES";
    effectiveVatNumber = userTaxId ?? undefined;
    showVatNumberInput = false;
  } else if (isB2B && userRegistrationCountry && userTaxId) {
    // B2B registered in non-ES country with stored tax ID: use shipping country, apply reverse charge
    effectiveBuyerCountry = formData.country;
    effectiveVatNumber = userTaxId;
    showVatNumberInput = false;
  } else {
    // Non-B2B or B2B without registration info: original logic
    const isEUNonSpain =
      formData.country !== "ES" && EU_COUNTRY_CODES.has(formData.country);
    showVatNumberInput = isB2B && isEUNonSpain;
    effectiveBuyerCountry = formData.country;
    effectiveVatNumber = showVatNumberInput ? formData.vatNumber : undefined;
  }

  const vatDetermination = determineVAT({
    subtotal: totalPrice,
    buyerCountry: effectiveBuyerCountry,
    buyerVATNumber: effectiveVatNumber,
  });

  const tax = vatDetermination.vatAmount;
  const selectedShippingMethod = shippingMethods.find(
    (method) => method.id === selectedShippingMethodId
  );
  const shippingCost = selectedShippingMethod
    ? selectedShippingMethod.price
    : 0;
  const total = totalPrice + tax + shippingCost;

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === "vatNumber" && value) {
      const validation = validateEUVATFormat(value);
      if (!validation.valid) {
        setVatNumberError(validation.message || "Formato inválido");
      } else {
        setVatNumberError("");
      }
    }
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName)
      newErrors.firstName = t("errors.required.first_name");
    if (!formData.lastName) newErrors.lastName = t("errors.required.last_name");
    if (!formData.address) newErrors.address = t("errors.required.address");
    if (!formData.city) newErrors.city = t("errors.required.city");
    if (!formData.zipCode) newErrors.zipCode = t("errors.required.zip_code");
    if (!formData.phone) newErrors.phone = t("errors.required.phone");

    if (showVatNumberInput && formData.vatNumber) {
      const v = validateEUVATFormat(formData.vatNumber);
      if (!v.valid) newErrors.vatNumber = v.message || "Número de IVA inválido";
    }
    if (shippingMethods.length > 0 && !selectedShippingMethodId) {
      newErrors.shippingMethod = t("select_shipping_error");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error(t("errors.fix_form"));
      return;
    }

    setIsSubmitting(true);

    try {
      const orderItems = items.map((item) => ({
        variantId: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const payload = {
        items: orderItems,
        totalAmount: total,
        shippingAddress: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          street: formData.address,
          city: formData.city,
          zipCode: formData.zipCode,
          country: formData.country,
          phone: formData.phone,
        },
        paymentMethod: formData.paymentMethod,
        poNumber: formData.poNumber || undefined,
        vatNumber: effectiveVatNumber,
        buyerCountry: effectiveBuyerCountry,
        shippingMethodId: selectedShippingMethodId || undefined,
        currency,
        exchangeRate,
      };

      const result = await createOrder(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.success && result.orderId) {
        clearCart();

        // Cecabank: redirect to TPV via hidden form auto-submit
        if (formData.paymentMethod === "CECABANK") {
          try {
            const initRes = await fetch("/api/payments/cecabank/init", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: result.orderId,
                locale,
              }),
            });

            if (!initRes.ok) {
              const errData = await initRes.json();
              toast.error(errData.error || t("errors.unexpected"));
              setIsSubmitting(false);
              return;
            }

            const { tpvUrl, fields } = await initRes.json();

            // Create and auto-submit a hidden form
            const form = document.createElement("form");
            form.method = "POST";
            form.action = tpvUrl;
            form.style.display = "none";

            for (const [key, value] of Object.entries(fields)) {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = key;
              input.value = value as string;
              form.appendChild(input);
            }

            document.body.appendChild(form);
            setIsSuccess(true);
            form.submit();
            return;
          } catch {
            toast.error(t("errors.unexpected"));
            setIsSubmitting(false);
            return;
          }
        }

        // Non-Cecabank: standard redirect to success page
        setIsSuccess(true);
        toast.success(t("errors.success"));
        const params = new URLSearchParams();
        if (result.orderId) params.set("orderId", result.orderId);
        router.push(`/checkout/success?${params.toString()}`);
        return;
      }
    } catch (error: any) {
      console.error(error);
      const msg = error?.message || "";
      if (msg.includes("Insufficient stock")) {
        toast.error(t("errors.insufficient_stock"));
      } else {
        toast.error(t("errors.unexpected"));
      }
    } finally {
      if (!isSuccess) {
        setIsSubmitting(false);
      }
    }
  };

  if (isSuccess) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">{t("processing_order")}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-4">{t("empty_cart")}</h1>
        <Button asChild>
          <Link href="/">{t("back_to_shop")}</Link>
        </Button>
      </div>
    );
  }

  const euCountries = COUNTRY_LIST.filter((c) => c.isEU);
  const nonEUCountries = COUNTRY_LIST.filter((c) => !c.isEU);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-foreground mb-8">{t("title")}</h1>

      <form onSubmit={handleCheckout}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("shipping_address")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {addresses && addresses.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t("my_addresses")}</Label>
                    <Select
                      value={selectedAddressId}
                      onValueChange={handleAddressSelect}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("select_saved_address")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">{t("new_address")}</SelectItem>
                        {addresses.map((addr) => (
                          <SelectItem key={addr.id} value={addr.id}>
                            {addr.firstName} {addr.lastName} - {addr.street},{" "}
                            {addr.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Separator className="my-4" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("first_name")}</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        handleInputChange("firstName", e.target.value)
                      }
                      className={errors.firstName ? "border-destructive" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-destructive">{errors.firstName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("last_name")}</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        handleInputChange("lastName", e.target.value)
                      }
                      className={errors.lastName ? "border-destructive" : ""}
                    />
                    {errors.lastName && (
                      <p className="text-sm text-destructive">{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">{t("address")}</Label>
                  <Input
                    id="address"
                    placeholder={t("address_placeholder")}
                    value={formData.address}
                    onChange={(e) =>
                      handleInputChange("address", e.target.value)
                    }
                    className={errors.address ? "border-destructive" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive">{errors.address}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">{t("city")}</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        handleInputChange("city", e.target.value)
                      }
                      className={errors.city ? "border-destructive" : ""}
                    />
                    {errors.city && (
                      <p className="text-sm text-destructive">{errors.city}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">{t("zip_code")}</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) =>
                        handleInputChange("zipCode", e.target.value)
                      }
                      className={errors.zipCode ? "border-destructive" : ""}
                    />
                    {errors.zipCode && (
                      <p className="text-sm text-destructive">{errors.zipCode}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">{t("country")}</Label>
                  <Select
                    value={formData.country}
                    onValueChange={(val) => {
                      handleInputChange("country", val);
                      handleInputChange("vatNumber", "");
                      setVatNumberError("");
                    }}
                  >
                    <SelectTrigger id="country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("eu_countries")}
                      </div>
                      {euCountries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                      <Separator className="my-1" />
                      <div className="px-2 py-1 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {t("non_eu_countries")}
                      </div>
                      {nonEUCountries.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t("phone")}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className={errors.phone ? "border-destructive" : ""}
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive">{errors.phone}</p>
                  )}
                </div>

                {showVatNumberInput && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label
                      htmlFor="vatNumber"
                      className="flex items-center gap-2"
                    >
                      {t("vat_number")}
                      <span className="text-sm font-normal text-muted-foreground">
                        {t("optional")}
                      </span>
                    </Label>
                    <Input
                      id="vatNumber"
                      placeholder={t("vat_number_placeholder")}
                      value={formData.vatNumber}
                      onChange={(e) =>
                        handleInputChange("vatNumber", e.target.value)
                      }
                      className={
                        errors.vatNumber || vatNumberError
                          ? "border-destructive"
                          : ""
                      }
                    />
                    {(errors.vatNumber || vatNumberError) && (
                      <p className="text-sm text-destructive">
                        {errors.vatNumber || vatNumberError}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {t("vat_number_desc")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("shipping")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {shippingMethods.length === 0 ? (
                  <div className="text-base text-muted-foreground">
                    {t("no_shipping_methods")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>{t("shipping_method")}</Label>
                    <Select
                      value={selectedShippingMethodId}
                      onValueChange={(val) => {
                        setSelectedShippingMethodId(val);
                        setErrors((prev) => ({ ...prev, shippingMethod: "" }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("select_shipping_method")} />
                      </SelectTrigger>
                      <SelectContent>
                        {shippingMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{method.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {fm(method.price)}
                                {method.estimatedDays
                                  ? ` · ${t("estimated_days", { days: method.estimatedDays })}`
                                  : ""}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedShippingMethod?.description && (
                      <div className="text-sm text-muted-foreground">
                        {selectedShippingMethod.description}
                      </div>
                    )}
                    {errors.shippingMethod && (
                      <p className="text-sm text-destructive">
                        {errors.shippingMethod}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("payment_method")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("select_method")}</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(val) =>
                      handleInputChange("paymentMethod", val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("select_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CECABANK">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" /> {t("credit_card")}
                        </div>
                      </SelectItem>
                      <SelectItem value="BANK_TRANSFER">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4" /> {t("bank_transfer")}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.paymentMethod === "CECABANK" && (
                  <div className="p-4 bg-muted rounded-lg border border-border text-base text-muted-foreground">
                    <p>{t("cecabank_desc")}</p>
                  </div>
                )}

                {formData.paymentMethod === "BANK_TRANSFER" && (
                  <div className="p-4 bg-accent/10 rounded-lg border border-accent/30 text-base text-accent">
                    <p className="font-medium">{t("bank_transfer_info")}</p>
                    <p>{t("bank_transfer_desc")}</p>
                  </div>
                )}

                {isB2B && (
                  <div className="pt-4 mt-4 border-t space-y-2">
                    <Label
                      htmlFor="poNumber"
                      className="flex items-center gap-2"
                    >
                      {t("po_number")}
                      <span className="text-sm font-normal text-muted-foreground">
                        {t("optional")}
                      </span>
                    </Label>
                    <Input
                      id="poNumber"
                      placeholder={t("po_placeholder")}
                      value={formData.poNumber}
                      onChange={(e) =>
                        handleInputChange("poNumber", e.target.value)
                      }
                    />
                    <p className="text-sm text-muted-foreground">{t("po_desc")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <CheckoutOrderSummary
              items={items}
              totalPrice={totalPrice}
              tax={tax}
              shippingCost={shippingCost}
              total={total}
              isSubmitting={isSubmitting}
              vatDetermination={vatDetermination}
              fm={fm}
              t={t}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
