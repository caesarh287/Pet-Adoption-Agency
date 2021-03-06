import mongoose from "mongoose";
import UserModel from "../models/user.js";
import petModel from "../models/petModel.js";

/* 
    All controllers
    for urls that starts with /pet/*
 */

export const getPets = async (req, res, next) => {
  const query = req.query;

  try {
    const pets = await petModel.find();
    let filteredPets = [
      ...pets.filter((pet) => pet.adoptionStatus === "Not adopted"),
      ...pets.filter((pet) => pet.adoptionStatus !== "Not adopted"),
    ];
    if (query) {
      for (const key of Object.keys(query)) {
        if (query[key] === "") continue;
        switch (key) {
          case "type":
            if (query[key] !== "All") {
              for (const type of query[key].split(",")) {
                filteredPets = filteredPets.filter((pet) =>
                  pet.type.includes(type)
                );
              }
            }
            break;
          case "name":
            filteredPets = filteredPets.filter((pet) =>
              pet.name.toLowerCase().includes(query[key].toLowerCase())
            );
            break;
          case "adoptionStatus":
            filteredPets = filteredPets.filter(
              (pet) => pet.adoptionStatus === query[key].toLowerCase()
            );
            break;
          case "minHeight":
          case "minWeight":
            filteredPets = filteredPets.filter(
              (pet) => pet[key.substring(3).toLowerCase()] > +query[key]
            );
            break;
          case "maxHeight":
          case "maxWeight":
            filteredPets = filteredPets.filter(
              (pet) => pet[key.substring(3).toLowerCase()] < +query[key]
            );
            break;
          default:
            break;
        }
      }
    }
    res.status(200).json(filteredPets);
  } catch (error) {
    console.log(error);
    res.status(409).send({ message: error.message });
  }
};

export const addPet = async (req, res) => {
  const pet = req.body;

  try {
    const newPet = new petModel(pet);
    console.log(newPet);
    await newPet.save();
    res.status(201).json(newPet);
  } catch (error) {
    console.log(error);
    res.status(409).send({ message: error.message });
  }
};

export const getPet = async (req, res) => {
  const id = req.params.id;

  try {
    const pet = await petModel.findById(id);
    if (!pet) return res.status(404).send(`No pet with id: ${id}`);
    res.json(pet);
  } catch (error) {
    res.status(409).send({ message: error.message });
  }
};

export const editPet = async (req, res) => {
  const { petId } = req.params;
  const pet = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(pet._id))
      return res.status(404).send(`No pet with id: ${petId}`);

    const editedPet = { ...pet, _id: pet._id };

    for (let prop in editedPet) if (!editedPet[prop]) delete editedPet[prop];

    const updatedPet = await petModel.findByIdAndUpdate(petId, pet, {
      new: true,
    });
    res.json(updatedPet);
  } catch (error) {
    console.log(error);
    res.status(409).send({ message: error.message });
  }
};

const addPetInList = async (list, petId, userId) => {
  if (!userId) throw Error("Unauthenticated");
  if (!mongoose.Types.ObjectId.isValid(petId)) throw Error("Pet not found");

  const user = await UserModel.findById(userId);

  if (user[list].includes(petId)) {
    throw new Error("Pet already in the pet list");
  }
  user[list].push(petId);
  const userInfo = await UserModel.findByIdAndUpdate(userId, user, {
    new: true,
  });
  return userInfo;
};

const removePetInList = async (list, petId, userId) => {
  if (!userId) throw Error("Unauthenticated");
  if (!mongoose.Types.ObjectId.isValid(petId)) throw Error("Pet not found");

  const user = await UserModel.findById(userId);

  if (!user[list].includes(petId)) {
    throw new Error("Pet not in the savedlist");
  }

  user[list] = user[list].filter((id) => id !== petId);
  const userInfo = await UserModel.findByIdAndUpdate(userId, user, {
    new: true,
  });

  return userInfo;
};

//type is adopt or foster
export const adoptPet = async (req, res) => {
  const { petId } = req.params;

  const {
    newAdoptionStatus,
    currentUser: { _id: userId },
  } = req.body;

  let userInfo;

  try {
    const newStatus = { adoptionStatus: null, adoptionOwner: null };
    switch (newAdoptionStatus) {
      case "adopt":
        userInfo = await addPetInList("listOfPetsAdopted", petId, userId);
        if (userInfo.listOfPetsFostered.includes(petId)) {
          TransactionModel.create({
            timestamp: new Date(),
            action: "return",
            userId: userId,
            petId: petId,
          });
          userInfo = await removePetInList("listOfPetsFostered", petId, userId);
        }
        newStatus.adoptionStatus = "adopt";
        break;
      case "foster":
        userInfo = await addPetInList("listOfPetsFostered", petId, userId);
        newStatus.adoptionStatus = "foster";
      default:
        break;
    }
    newStatus.adoptionOwner = userId;
    await petModel.findByIdAndUpdate(petId, newStatus, { new: true });
  } catch (error) {
    res.status(404).send({ error: error.message });
    return;
  }

  if (!userInfo || userInfo === "") {
    res.status(404).send({ error: error.message });
    return;
  }
  res.status(200).json(userInfo);
};

export const returnPet = async (req, res) => {
  const { petId } = req.params;
  const {
    currentUser: { _id: userId },
  } = req.body;
  let userInfo = "";

  try {
    if (!userId) throw Error("Unauthenticated");
    if (!mongoose.Types.ObjectId.isValid(petId)) throw Error("Pet not found");

    const pet = await petModel.findById(petId);

    switch (pet.adoptionStatus) {
      case "adopt":
        userInfo = await removePetInList("listOfPetsAdopted", petId, userId);
        break;
      case "foster":
        userInfo = await removePetInList("listOfPetsFostered", petId, userId);
        break;
      default:
        console.log("Supposed to be foster or adopt");
        throw Error("Supposed to be foster or adopt");
    }
    const newStatus = { adoptionStatus: "available", adoptionOwner: null };
    await petModel.findByIdAndUpdate(petId, newStatus, { new: true });
  } catch (error) {
    res.status(404).send({ error: error.message });
    return;
  }

  if (!userInfo || userInfo === "") {
    console.log("user is null");
    res.status(404).send({ error: "User is null" });
    return;
  }

  res.status(200).json(userInfo);
};

export const savePet = async (req, res) => {
  const { petId } = req.params;
  const {
    currentUser: { _id: userId },
  } = req.body;

  try {
    const userInfo = await addPetInList("listOfPetsSaved", petId, userId);

    // await petModel.updateOne({ _id: petId });
    res.status(200).json(userInfo);
  } catch (error) {
    res.status(404).send({ error: error.message });
  }
};

export const unsavePet = async (req, res) => {
  const { petId } = req.params;
  const {
    currentUser: { _id: userId },
  } = req.body;
  try {
    const userInfo = await removePetInList("listOfPetsSaved", petId, userId);
    res.status(200).json(userInfo);
  } catch (err) {
    res.status(404).send({ error: error.message });
  }
};

export const deletePet = async (req, res) => {
  const { petId } = req.params;
  let userInfo;
  try {
    const users = await UserModel.find();
    users.forEach(async (user) => {
      if (user.listOfPetsSaved.includes(petId)) {
        userInfo = await removePetInList("listOfPetsSaved", petId, user._id);
      }
      if (user.listOfPetsAdopted.includes(petId)) {
        userInfo = await removePetInList("listOfPetsAdopted", petId, user._id);
      }
    });
    await petModel.deleteOne({ _id: petId });
    res.status(200).json(userInfo);
  } catch (error) {
    res.status(404).send({ error: error.message });
  }
};

export const getPetsByUserId = async (req, res) => {
  const { id: userId } = req.params;

  try {
    const {
      listOfPetsSaved: listOfPetsIdSaved,
      listOfPetsAdopted: listOfPetsIdAdopted,
      listOfPetsFostered: listOfPetsIdFostered,
    } = await UserModel.findById(userId);

    const listOfPetsSaved = [];
    for (const petId of listOfPetsIdSaved) {
      const pet = await petModel.findById(petId);
      listOfPetsSaved.push(pet);
    }

    const listOfPetsAdopted = [];
    for (const petId of listOfPetsIdAdopted) {
      const pet = await petModel.findById(petId);
      listOfPetsAdopted.push(pet);
    }

    const listOfPetsFostered = [];
    for (const petId of listOfPetsIdFostered) {
      const pet = await petModel.findById(petId);
      listOfPetsFostered.push(pet);
    }
    console.log(listOfPetsAdopted);
    res
      .status(200)
      .json({ listOfPetsSaved, listOfPetsAdopted, listOfPetsFostered });
  } catch (error) {
    res.status(404).send({ error: error.message });
  }
};
