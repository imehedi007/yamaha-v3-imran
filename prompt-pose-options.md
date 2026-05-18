## Pose Selection Rule
Randomly select **exactly ONE** pose from the 5 pose options below and use only that pose for the final image.  
Do not combine poses or mix body positions.

Maintain natural body mechanics, realistic limb proportions, and balanced posture.  
Keep the pose composition visually similar to the selected reference description.


# Pose Options

## Pose 1
Standing beside the motorcycle in a full-body pose with both arms crossed over the chest, body angled slightly toward the bike, head turned slightly away from camera, confident and dominant presence.

## Pose 2
Sitting sideways on the motorcycle seat in a relaxed lifestyle pose, one foot planted on the ground, upper body slightly turned toward camera, one hand resting on or holding the helmet naturally.

## Pose 3
Standing next to the motorcycle with one hand adjusting the neck or hoodie collar area while the other hand holds a helmet at the side, calm cinematic hero pose with relaxed confidence.

## Pose 4
Sitting on the motorcycle in an urban editorial pose, torso leaning slightly forward, both forearms resting on a helmet placed near the tank or handlebar area, composed and relaxed expression.

## Pose 5
Walking beside the parked motorcycle while carrying a helmet in one hand, natural mid-step movement, body leaning slightly forward as if arriving or leaving, cinematic travel atmosphere.

# Negative Prompt

Do NOT include any of the following:

- torn clothing
- ripped shirt
- damaged trousers
- worn-out shoes
- dirty outfit
- messy wardrobe
- broken accessories
- deformed motorcycle
- warped motorcycle frame
- unrealistic bike proportions
- rusty motorcycle parts
- damaged mechanical components
- low-quality motorcycle detailing
- distorted anatomy
- extra limbs
- awkward hands
- unnatural posture
- duplicated body parts
- oversaturated colors
- poorly rendered helmet
- floating objects
- cluttered background

# Bike Reference URL Notes

## Current Process

The `bikes` table has an `image_url` field.
Right now, the generation flow may select and carry that bike URL in backend selection data, but the bike image itself is not attached to Gemini as a visual reference during image generation.

Current generation behavior:

1. The backend selects a bike from the database based on quiz mapping, weight distribution, and color preference.
2. The selected bike model name and resolved bike color are written into the final text prompt.
3. Gemini receives the user face image as the visual reference input.
4. Gemini does not currently receive the selected bike image from `image_url` as an attached bike reference.

Because of that, bike matching is currently text-guided, not image-guided.

## If Bike URL Is Attached Later

If the selected bike image from `image_url` is attached as an additional visual reference later, the likely process would be:

1. Select the bike from the database as usual.
2. Read or download the bike image from `image_url`.
3. Convert that bike image into a model-ready inline image payload.
4. Send that bike image together with the user image and the final prompt to Gemini.
5. Gemini uses:
   - the user image for face identity
   - the bike image for bike shape and design reference
   - the final prompt for pose, environment, styling, and negative prompting

## Expected Time Impact

Yes, attaching the bike image will likely increase generation time somewhat.

Reasons:

- one more image must be fetched or loaded
- one more image must be encoded and added to the request
- the model must process additional visual context
- larger request payloads can increase latency

In return, bike matching accuracy should improve because the bike would be both text-guided and image-guided instead of text-guided only.
