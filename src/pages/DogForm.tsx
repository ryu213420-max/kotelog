import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { photoUrl, uploadPhoto, useDeleteDog, useSaveDog } from "../api";
import { Spinner } from "../components/AddRecordSheet";
import { FormSkeleton } from "../components/Skeletons";
import { IconBack, IconCamera } from "../components/icons";
import { Page, PressButton, rise, spring, stagger, useToast } from "../components/ui";
import { useCurrentDog } from "../dogContext";

export default function DogForm({ first }: { first?: boolean }) {
  const { id } = useParams();
  const { dogs, loading, setDogId } = useCurrentDog();
  const nav = useNavigate();
  const save = useSaveDog();
  const del = useDeleteDog();
  const toast = useToast();
  const existing = dogs.find((d) => d.id === id);

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<"male" | "female" | null>(null);
  const [birthday, setBirthday] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setBreed(existing.breed ?? "");
    setSex(existing.sex);
    setBirthday(existing.birthday ?? "");
    setPhotoKey(existing.photo_key);
  }, [existing]);

  if (loading || (id && !existing && dogs.length)) return <FormSkeleton />;

  const onFile = async (f?: File) => {
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    setUploading(true);
    try {
      setPhotoKey(await uploadPhoto(f));
    } catch {
      toast("写真をアップロードできませんでした");
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) return toast("名前を入力してください");
    const d = await save.mutateAsync({ id: existing?.id, name, breed: breed || null, sex, birthday: birthday || null, photo_key: photoKey });
    setDogId(d.id);
    toast(existing ? "保存しました" : `${d.name}を登録しました`);
    nav("/", { replace: true });
  };

  const remove = async () => {
    if (!existing || !confirm(`${existing.name}と全ての記録を削除しますか？`)) return;
    await del.mutateAsync(existing.id);
    toast("削除しました");
    nav("/settings", { replace: true });
  };

  const img = preview ?? photoUrl(photoKey);

  return (
    <Page>
      {!first && (
        <PressButton aria-label="戻る" onClick={() => nav(-1)} className="glass grid h-10 w-10 place-items-center rounded-full">
          <IconBack size={20} />
        </PressButton>
      )}
      <motion.div variants={stagger} initial="hidden" animate="show" className="mt-2">
        <motion.h1 variants={rise} className={`text-center text-2xl font-black ${first ? "mt-10" : ""}`}>
          {existing ? "プロフィール" : "わんこを登録"}
        </motion.h1>

        <motion.div variants={rise} className="mt-6 flex justify-center">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} data-testid="dog-photo-input" />
          <motion.button
            whileTap={{ scale: 0.93 }}
            transition={spring}
            onClick={() => fileRef.current?.click()}
            aria-label="写真を選ぶ"
            className="glass glass-refract relative grid h-32 w-32 place-items-center overflow-hidden rounded-full"
          >
            {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <IconCamera size={34} className="opacity-60" />}
            {uploading && <div className="sk absolute inset-0 !rounded-full" />}
          </motion.button>
        </motion.div>

        <motion.label variants={rise} className="mt-7 block">
          <span className="mb-1.5 block px-1 text-xs font-bold opacity-60">名前</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field" data-testid="dog-name-input" maxLength={40} autoFocus={!existing} />
        </motion.label>
        <motion.label variants={rise} className="mt-4 block">
          <span className="mb-1.5 block px-1 text-xs font-bold opacity-60">犬種</span>
          <input value={breed} onChange={(e) => setBreed(e.target.value)} className="field" data-testid="dog-breed-input" maxLength={60} />
        </motion.label>
        <motion.div variants={rise} className="mt-4">
          <span className="mb-1.5 block px-1 text-xs font-bold opacity-60">性別</span>
          <div className="glass relative flex rounded-2xl p-1">
            {(["male", "female"] as const).map((s) => (
              <button key={s} onClick={() => setSex(sex === s ? null : s)} aria-pressed={sex === s} className="relative flex-1 rounded-xl py-2.5 text-sm font-bold">
                {sex === s && <motion.span layoutId="sex-pill" className="btn-accent absolute inset-0 rounded-xl" transition={spring} />}
                <span className={`relative ${sex === s ? "text-[var(--accent-ink)]" : ""}`}>{s === "male" ? "男の子" : "女の子"}</span>
              </button>
            ))}
          </div>
        </motion.div>
        <motion.label variants={rise} className="mt-4 block">
          <span className="mb-1.5 block px-1 text-xs font-bold opacity-60">誕生日</span>
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="field" data-testid="dog-birthday-input" />
        </motion.label>

        <motion.div variants={rise}>
          <PressButton
            onClick={submit}
            disabled={save.isPending || uploading}
            data-testid="dog-save"
            className="btn-accent mt-8 h-14 w-full rounded-[22px] text-lg font-black disabled:opacity-60"
          >
            {save.isPending ? <Spinner /> : existing ? "保存" : "登録"}
          </PressButton>
        </motion.div>
        {existing && (
          <motion.button variants={rise} onClick={remove} className="mt-4 w-full py-3 text-sm font-bold" style={{ color: "var(--health)" }} data-testid="dog-delete">
            削除
          </motion.button>
        )}
      </motion.div>
    </Page>
  );
}
