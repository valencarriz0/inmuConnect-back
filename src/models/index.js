import User from "./User.js";
import PublisherApplication from "./PublisherApplication.js";
import PublisherProfile from "./PublisherProfile.js";
import Province from "./Province.js";
import City from "./City.js";
import Service from "./Service.js";
import Amenity from "./Amenity.js";
import Property from "./Property.js";
import PropertyImage from "./PropertyImage.js";
import PropertyService from "./PropertyService.js";
import PropertyAmenity from "./PropertyAmenity.js";
import Favorite from "./Favorite.js";
import Consultation from "./Consultation.js";
import PropertyView from "./PropertyView.js";
import SearchAlert from "./SearchAlert.js";
import PropertyChangeHistory from "./PropertyChangeHistory.js";
import Notification from "./Notification.js";

// Las acciones referenciales reflejan las FK existentes; no se ejecuta DDL.
PublisherApplication.belongsTo(User, {
  as: "applicant",
  foreignKey: "userId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
User.hasMany(PublisherApplication, {
  as: "publisherApplications",
  foreignKey: "userId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

PublisherApplication.belongsTo(User, {
  as: "reviewer",
  foreignKey: "reviewedBy",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
User.hasMany(PublisherApplication, {
  as: "reviewedApplications",
  foreignKey: "reviewedBy",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

PublisherProfile.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
User.hasOne(PublisherProfile, {
  as: "publisherProfile",
  foreignKey: "userId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

City.belongsTo(Province, {
  as: "province",
  foreignKey: "provinceId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
Province.hasMany(City, {
  as: "cities",
  foreignKey: "provinceId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

Property.belongsTo(PublisherProfile, {
  as: "publisher",
  foreignKey: "publisherId",
  targetKey: "userId",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
PublisherProfile.hasMany(Property, {
  as: "properties",
  foreignKey: "publisherId",
  sourceKey: "userId",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

Property.belongsTo(City, {
  as: "city",
  foreignKey: "cityId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
City.hasMany(Property, {
  as: "properties",
  foreignKey: "cityId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

PropertyImage.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});
Property.hasMany(PropertyImage, {
  as: "images",
  foreignKey: "propertyId",
  sourceKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

PropertyService.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});
Property.hasMany(PropertyService, {
  as: "propertyServices",
  foreignKey: "propertyId",
  sourceKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

PropertyService.belongsTo(Service, {
  as: "service",
  foreignKey: "serviceId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
Service.hasMany(PropertyService, {
  as: "propertyServices",
  foreignKey: "serviceId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

PropertyAmenity.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});
Property.hasMany(PropertyAmenity, {
  as: "propertyAmenities",
  foreignKey: "propertyId",
  sourceKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

PropertyAmenity.belongsTo(Amenity, {
  as: "amenity",
  foreignKey: "amenityId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
Amenity.hasMany(PropertyAmenity, {
  as: "propertyAmenities",
  foreignKey: "amenityId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

Favorite.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});
User.hasMany(Favorite, {
  as: "favorites",
  foreignKey: "userId",
  sourceKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

Favorite.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});
Property.hasMany(Favorite, {
  as: "favorites",
  foreignKey: "propertyId",
  sourceKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

Consultation.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
Property.hasMany(Consultation, {
  as: "consultations",
  foreignKey: "propertyId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

Consultation.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
  targetKey: "id",
  onDelete: "SET NULL",
  onUpdate: "NO ACTION",
});
User.hasMany(Consultation, {
  as: "consultations",
  foreignKey: "userId",
  sourceKey: "id",
  onDelete: "SET NULL",
  onUpdate: "NO ACTION",
});

PropertyView.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
Property.hasMany(PropertyView, {
  as: "views",
  foreignKey: "propertyId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

SearchAlert.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});
User.hasMany(SearchAlert, {
  as: "searchAlerts",
  foreignKey: "userId",
  sourceKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

SearchAlert.belongsTo(Province, {
  as: "province",
  foreignKey: "provinceId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
Province.hasMany(SearchAlert, {
  as: "searchAlerts",
  foreignKey: "provinceId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

SearchAlert.belongsTo(City, {
  as: "city",
  foreignKey: "cityId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
City.hasMany(SearchAlert, {
  as: "searchAlerts",
  foreignKey: "cityId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

PropertyChangeHistory.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
Property.hasMany(PropertyChangeHistory, {
  as: "changeHistory",
  foreignKey: "propertyId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

PropertyChangeHistory.belongsTo(User, {
  as: "actor",
  foreignKey: "changedBy",
  targetKey: "id",
  onDelete: "SET NULL",
  onUpdate: "NO ACTION",
});
User.hasMany(PropertyChangeHistory, {
  as: "propertyChanges",
  foreignKey: "changedBy",
  sourceKey: "id",
  onDelete: "SET NULL",
  onUpdate: "NO ACTION",
});

Notification.belongsTo(User, {
  as: "user",
  foreignKey: "userId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});
User.hasMany(Notification, {
  as: "notifications",
  foreignKey: "userId",
  sourceKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

Notification.belongsTo(Consultation, {
  as: "consultation",
  foreignKey: "consultationId",
  targetKey: "id",
  onDelete: "SET NULL",
  onUpdate: "NO ACTION",
});
Consultation.hasMany(Notification, {
  as: "notifications",
  foreignKey: "consultationId",
  sourceKey: "id",
  onDelete: "SET NULL",
  onUpdate: "NO ACTION",
});

Notification.belongsTo(PublisherApplication, {
  as: "publisherApplication",
  foreignKey: "publisherApplicationId",
  targetKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});
PublisherApplication.hasMany(Notification, {
  as: "notifications",
  foreignKey: "publisherApplicationId",
  sourceKey: "id",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

Notification.belongsTo(SearchAlert, {
  as: "searchAlert",
  foreignKey: "searchAlertId",
  targetKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});
SearchAlert.hasMany(Notification, {
  as: "notifications",
  foreignKey: "searchAlertId",
  sourceKey: "id",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

Notification.belongsTo(Property, {
  as: "property",
  foreignKey: "propertyId",
  targetKey: "id",
  onDelete: "SET NULL",
  onUpdate: "NO ACTION",
});
Property.hasMany(Notification, {
  as: "notifications",
  foreignKey: "propertyId",
  sourceKey: "id",
  onDelete: "SET NULL",
  onUpdate: "NO ACTION",
});

Property.belongsToMany(Service, {
  as: "services",
  through: { model: PropertyService, unique: false },
  foreignKey: "propertyId",
  otherKey: "serviceId",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

Service.belongsToMany(Property, {
  as: "properties",
  through: { model: PropertyService, unique: false },
  foreignKey: "serviceId",
  otherKey: "propertyId",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

Property.belongsToMany(Amenity, {
  as: "amenities",
  through: { model: PropertyAmenity, unique: false },
  foreignKey: "propertyId",
  otherKey: "amenityId",
  onDelete: "CASCADE",
  onUpdate: "NO ACTION",
});

Amenity.belongsToMany(Property, {
  as: "properties",
  through: { model: PropertyAmenity, unique: false },
  foreignKey: "amenityId",
  otherKey: "propertyId",
  onDelete: "RESTRICT",
  onUpdate: "NO ACTION",
});

export {
  User,
  PublisherApplication,
  PublisherProfile,
  Province,
  City,
  Service,
  Amenity,
  Property,
  PropertyImage,
  PropertyService,
  PropertyAmenity,
  Favorite,
  Consultation,
  PropertyView,
  SearchAlert,
  PropertyChangeHistory,
  Notification,
};
