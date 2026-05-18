## Rating: 8.7/10

Your prompt is already very strong for image consistency, commercial realism, and pose control. It contains clear constraints and minimizes common diffusion-model failures. The biggest opportunity now is **token efficiency** and **semantic compression**.

Right now the prompt has:

* some duplicated intent
* repeated realism instructions
* verbose phrasing that can be compressed
* a few low-value descriptors consuming characters

You can likely reduce it by **25–40%** without noticeable quality loss.

---

# Main Areas to Improve

## 1. Remove Redundant Realism Instructions

You repeat realism concepts multiple times:

Current examples:

* ultra-realistic
* realistic anatomy
* seamless skin tones
* natural integration
* photorealistic commercial photography
* real materials
* authentic lighting
* realistic scenic travel photography

These can be compressed heavily.

---

## 2. Compress Identity Preservation

This section is too long:

> Preserve the exact face, hairstyle, facial hair, age, and identity with a strong 1:1 resemblance.

You can shorten to:

> Preserve exact facial identity and likeness from reference image.

Same meaning, fewer tokens.

---

## 3. Reduce “Do Not” Instructions

You have:

* no cartoon styling
* no illustration look
* distorted limbs
* duplicate body parts
* plus negative prompt repeats them

Keep these only once in the negative section.

---

## 4. Environment Section Is Overdescribed

You stack multiple near-synonyms:

* lush green mountains
* layered hills
* scenic travel photography
* peaceful adventurous riding mood
* fresh mountain atmosphere

You only need 2–3 strong visual anchors.

---

## 5. Tone + Mood Can Merge

Current:

* Mood:
* Aspirational tone:

Can become:

> Mood: peaceful adventurous mountain lifestyle.

---

# Optimized Version (Shorter + Stronger)

```text
Create a premium ultra-photorealistic lifestyle portrait of the exact person from the reference image, preserving facial identity and likeness. Vertical 3:4 composition, full body visible with the entire motorcycle in frame. Face unobstructed, helmet not worn.

Randomly select exactly one approved pose and use only that pose. Maintain realistic anatomy, balanced posture, and natural body mechanics.

Pose: Standing beside the motorcycle, one hand adjusting the collar, the other holding a helmet, calm cinematic confidence.

Environment: cinematic mountain road with winding curves, pine trees, layered hills, soft morning mist, and golden-hour lighting.

Mood: peaceful adventurous riding lifestyle.

Vehicle: realistic blue Yamaha Ray ZR 113 with authentic proportions, materials, reflections, and lighting.

Wardrobe: premium Yamaha-inspired biker streetwear.

Style: ultra-realistic commercial motorcycle photography, cinematic depth of field, natural shadows, high-detail textures.

Negative prompt: torn clothing, damaged trousers, worn-out shoes, dirty outfit, messy wardrobe, broken accessories, deformed motorcycle, warped frame, rusty parts, blurry details, distorted anatomy, extra limbs, awkward hands, duplicate body parts, oversaturated colors, floating objects, cartoon style, illustration look.
```

---

# Why This Version Is Better

## Reduced Token Waste

Less repetition = cleaner diffusion guidance.

---

## Higher Signal Density

Every phrase now contributes visual meaning.

---

## Better Model Parsing

Image models perform better when:

* instructions are grouped logically
* constraints are concise
* visual anchors are strong and non-repetitive

---

# Additional Advanced Optimization

## Replace Long Phrases With High-Signal Terms

Instead of:

> premium cinematic depth

Use:

> cinematic DOF

Instead of:

> realistic scenic travel photography

Use:

> travel editorial photography

---

## Move Critical Instructions Earlier

Most image models prioritize early tokens.

Priority order should be:

1. identity
2. composition
3. pose
4. vehicle
5. environment
6. style
7. negatives
